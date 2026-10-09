import { open } from "node:fs/promises";

import { analyzeOriginalCoverage } from "./original-coverage-preflight";

const maxSnapshotBytes = 32 * 1024 * 1024;

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--input" || !args[1]) {
    throw new Error(
      "Usage: ts-node src/colorings/check-original-coverage.ts --input snapshot.json",
    );
  }
  // No database client, environment loading, network calls, writes or apply mode.
  const file = await open(args[1], "r");
  let input: unknown;
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxSnapshotBytes) {
      throw new Error("Snapshot must be a regular JSON file of at most 32 MiB");
    }
    const content = await file.readFile({ encoding: "utf8" });
    if (Buffer.byteLength(content) > maxSnapshotBytes) {
      throw new Error("Snapshot exceeds 32 MiB");
    }
    try {
      input = JSON.parse(content);
    } catch {
      throw new Error("Snapshot is not valid JSON");
    }
  } finally {
    await file.close();
  }
  const report = analyzeOriginalCoverage(input);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.coverageReady ? 0 : 2;
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Original coverage check failed"}\n`,
  );
  process.exitCode = 1;
});
