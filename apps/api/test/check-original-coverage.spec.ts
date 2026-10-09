import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { describe, it, type TestContext } from "node:test";

const apiRoot = resolve(__dirname, "..");
const script = resolve(apiRoot, "src/colorings/check-original-coverage.ts");
const checksum = "a".repeat(64);
function run(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--require", "ts-node/register/transpile-only", script, ...args],
    {
      cwd: apiRoot,
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, DATABASE_URL: "invalid:must-not-be-used" },
    },
  );
}
async function snapshot(t: TestContext, content: string) {
  const directory = await mkdtemp(join(tmpdir(), "artmate-coverage-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "snapshot.json");
  await writeFile(path, content);
  return path;
}

describe("Original coverage CLI", () => {
  it("reads a local snapshot and returns coverage only, without changing the input", async (t) => {
    const content = JSON.stringify({
      version: 1,
      sourceFingerprint: checksum,
      colorings: [],
      works: [],
    });
    const path = await snapshot(t, content);
    const result = run(["--input", path]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.scope, "original-coverage-only");
    assert.deepEqual(report.policy, {
      catalog: "original",
      workshop: "original",
      digitalDefault: "artmate-168",
    });
    assert.ok(report.requiredChecks.length > 0);
    assert.equal("canApply" in report, false);
    assert.equal(await readFile(path, "utf8"), content);
  });

  it("returns exit 2 and a report when a public picture has no original", async (t) => {
    const path = await snapshot(
      t,
      JSON.stringify({
        version: 1,
        sourceFingerprint: checksum,
        colorings: [
          {
            id: "picture",
            public: true,
            original: null,
            legacy: {
              imageChecksum: checksum,
              width: 100,
              height: 100,
              symbolPositions: [1, 18],
            },
          },
        ],
        works: [],
      }),
    );
    const result = run(["--input", path]);
    assert.equal(result.status, 2, result.stderr);
    assert.deepEqual(
      JSON.parse(result.stdout).publicAvailabilityLoss.coloringIds,
      ["picture"],
    );
  });

  it("rejects malformed or invalid snapshots without echoing their contents", async (t) => {
    for (const content of [
      "not-json-private-content",
      JSON.stringify({ version: 999 }),
    ]) {
      const path = await snapshot(t, content);
      const result = run(["--input", path]);
      assert.equal(result.status, 1);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr.includes("not-json-private-content"), false);
    }
  });

  it("does not accept apply flags or a missing input", () => {
    for (const args of [
      [],
      ["--apply"],
      ["--input", "unused.json", "--apply"],
    ]) {
      const result = run(args);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Usage:/);
      assert.equal(result.stdout, "");
    }
  });
});
