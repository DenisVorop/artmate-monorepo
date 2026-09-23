import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

export function testBatches(files) {
  const specs = files.filter((file) => file.endsWith(".spec.ts")).sort();
  return [
    { concurrency: 2, files: specs.filter((file) => !file.endsWith(".postgres.spec.ts")) },
    { concurrency: 1, files: specs.filter((file) => file.endsWith(".postgres.spec.ts")) },
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const batches = testBatches(readdirSync(resolve(cwd, "test")));
  if (!batches.some((batch) => batch.files.length)) throw new Error("No API tests found");
  for (const batch of batches) {
    if (!batch.files.length) continue;
    // pretest checks all source/test types once. Each isolated process only transpiles.
    const result = spawnSync(process.execPath, [
      "--test",
      "--test-reporter=spec",
      `--test-concurrency=${batch.concurrency}`,
      "--require", "ts-node/register/transpile-only",
      ...batch.files.map((file) => `test/${file}`),
    ], { cwd, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}
