import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { ColoringMediaService } from "./coloring-media.service";
import { ColoringStorageService } from "./coloring-storage.service";
import {
  defaultColoringStorageRoots,
  importOriginals,
  OriginalImportValidationError,
} from "./original-import";
import {
  validateOriginalImportPlan,
  type OriginalImportPlan,
} from "./original-import-plan";

type Arguments = {
  apply: boolean;
  production: boolean;
  plan: string;
  bundle: string;
  confirm?: string;
};

export function parseImportArguments(argv: string[]): Arguments {
  const values = new Map<string, string>();
  let apply = false;
  let production = false;
  for (const item of argv) {
    if (item === "--apply") apply = true;
    else if (item === "--production") production = true;
    else if (item === "--local" || item === "--check") continue;
    else {
      const match = /^--(plan|bundle|confirm)=(.+)$/.exec(item);
      if (!match || values.has(match[1]!))
        throw new Error("Invalid import arguments");
      values.set(match[1]!, match[2]!);
    }
  }
  if (apply && !values.has("confirm"))
    throw new Error("Apply requires --confirm=<planHash>");
  if (!production && !argv.includes("--local"))
    throw new Error("Choose --local or --production explicitly");
  if (production && argv.includes("--local"))
    throw new Error("Choose only one database mode");
  const plan = values.get("plan");
  const bundle = values.get("bundle");
  if (!plan || !bundle || !isAbsolute(plan) || !isAbsolute(bundle))
    throw new Error(
      "Usage: import-originals.ts --local|--production --plan=/absolute/plan.json --bundle=/absolute/bundle [--apply --confirm=<planHash>]",
    );
  return { apply, production, plan, bundle, confirm: values.get("confirm") };
}

export function importDatabaseUrl(
  mode: "local" | "production",
  environment: NodeJS.ProcessEnv = process.env,
) {
  const value =
    environment.ORIGINAL_IMPORT_DATABASE_URL ??
    (mode === "production" ? environment.DATABASE_URL : undefined);
  if (!value) throw new Error("Set ORIGINAL_IMPORT_DATABASE_URL explicitly");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid import database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hash ||
    [...url.searchParams].some(
      ([key, entry]) => key !== "schema" || entry !== "public",
    )
  )
    throw new Error("Unsupported import database URL");
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (mode === "local" && !isLocal)
    throw new Error("--local accepts only a localhost PostgreSQL database");
  if (mode === "production" && isLocal)
    throw new Error("--production requires a nonlocal PostgreSQL database");
  return value;
}

async function readPlan(path: string): Promise<OriginalImportPlan> {
  const absolute = resolve(path);
  const stat = await lstat(absolute);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size <= 0 ||
    stat.size > 5 * 1024 * 1024 ||
    (await realpath(absolute)) !== absolute
  )
    throw new Error("Import plan file is missing, too large or linked");
  const value: unknown = JSON.parse(await readFile(absolute, "utf8"));
  validateOriginalImportPlan(value);
  return value;
}

async function main() {
  const args = parseImportArguments(process.argv.slice(2));
  const plan = await readPlan(args.plan);
  if (args.apply && args.confirm !== plan.planHash)
    throw new Error("Confirmation hash does not match the import plan");
  const connectionString = importDatabaseUrl(
    args.production ? "production" : "local",
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  });
  const media = new ColoringMediaService();
  const storage = new ColoringStorageService(
    media,
    defaultColoringStorageRoots(),
  );
  try {
    const report = await importOriginals(
      { prisma, media, storage },
      { plan, bundleRoot: args.bundle, apply: args.apply },
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    if (error instanceof OriginalImportValidationError) throw error;
    throw new Error(
      "Original import failed. Check the plan, local database schema and coloring storage; database credentials and driver details were suppressed.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Original import failed"}\n`,
    );
    process.exitCode = 1;
  });
}
