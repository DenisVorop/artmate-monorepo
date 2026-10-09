import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { exportOriginalCoverageSnapshot } from "./original-coverage-export";

export function localCoverageDatabaseUrl(value: string | undefined): string {
  if (!value)
    throw new Error(
      "Set ORIGINAL_COVERAGE_DATABASE_URL explicitly; .env is not loaded",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid local database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname.length < 2 ||
    url.hash ||
    [...url.searchParams].some(
      ([key, entry]) => key !== "schema" || entry !== "public",
    )
  )
    throw new Error(
      "Only a local PostgreSQL database is allowed; connection overrides are not supported",
    );
  return value;
}

export function originalsSchemaMode(tables: {
  artworks: boolean;
  originals: boolean;
  colors: boolean;
}) {
  if (tables.artworks && tables.originals && tables.colors)
    return "present" as const;
  if (!tables.artworks && !tables.originals && !tables.colors)
    return "legacy-only" as const;
  throw new Error(
    "Partial originals schema: export aborted; no migrations were applied",
  );
}

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "--local") {
    throw new Error(
      "Usage: ts-node src/colorings/export-original-coverage.ts --local",
    );
  }
  const connectionString = localCoverageDatabaseUrl(
    process.env.ORIGINAL_COVERAGE_DATABASE_URL,
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      options: "-c default_transaction_read_only=on -c statement_timeout=20000",
      connectionTimeoutMillis: 5000,
    }),
  });
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        const settings = await tx.$queryRaw<
          Array<{ transaction_read_only: string }>
        >`SHOW transaction_read_only`;
        if (settings[0]?.transaction_read_only !== "on")
          throw new Error("Read-only transaction is required");
        const tables = await tx.$queryRaw<
          Array<{ artworks: boolean; originals: boolean; colors: boolean }>
        >`
        SELECT to_regclass('public.coloring_artworks') IS NOT NULL AS artworks,
          to_regclass('public.coloring_originals') IS NOT NULL AS originals,
          to_regclass('public.coloring_original_colors') IS NOT NULL AS colors`;
        if (!tables[0]) throw new Error("Unable to inspect originals schema");
        return exportOriginalCoverageSnapshot(tx, {
          originalsSchema: originalsSchemaMode(tables[0]),
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      },
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.exportReady ? 0 : 2;
  } catch (error) {
    // Driver errors can contain connection details. Never echo them or the URL.
    if (
      error instanceof Error &&
      error.message.startsWith("Partial originals schema:")
    )
      throw error;
    throw new Error(
      "Read-only export failed. Check the local connection and schema; no migrations were applied.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Read-only export failed"}\n`,
    );
    process.exitCode = 1;
  });
}
