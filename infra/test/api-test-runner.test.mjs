import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { testBatches } from "../../apps/api/scripts/test.mjs";

test("API test batches cover every spec once and serialize shared PostgreSQL tests", () => {
  const files = readdirSync(new URL("../../apps/api/test/", import.meta.url));
  const [isolated, postgres] = testBatches(files);
  assert.equal(isolated.concurrency, 2);
  assert.equal(postgres.concurrency, 1);
  assert.ok(isolated.files.length > 0);
  assert.ok(postgres.files.length > 0);
  assert.ok(isolated.files.every((file) => !file.endsWith(".postgres.spec.ts")));
  assert.ok(postgres.files.every((file) => file.endsWith(".postgres.spec.ts")));
  assert.deepEqual(
    [...isolated.files, ...postgres.files].sort(),
    files.filter((file) => file.endsWith(".spec.ts")).sort(),
  );
});

test("API type checking remains mandatory before the transpile-only runner", () => {
  const { scripts } = JSON.parse(readFileSync(new URL("../../apps/api/package.json", import.meta.url), "utf8"));
  assert.equal(scripts.pretest, "prisma generate && yarn check-types:test");
  assert.equal(scripts["check-types:test"], "tsc --noEmit -p tsconfig.test.json");
  assert.equal(scripts.test, "node scripts/test.mjs");
});
