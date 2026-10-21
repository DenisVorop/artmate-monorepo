import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");
const fixture = {
  AUTH_JWT_SECRET: "jwt-" + "a".repeat(48),
  AUTH_FLOW_PROXY_SECRET: "proxy-" + "b".repeat(48),
  ADVERTISING_RECIPIENT_HMAC_SECRET: "recipient-" + "c".repeat(48),
  ADVERTISING_RECIPIENT_KEY_VERSION: "v1",
};

function validate(overrides = {}, second = undefined) {
  const dir = mkdtempSync(join(tmpdir(), "artmate-env-test-"));
  try {
    const required = join(dir, "required");
    const file = join(dir, "fixture.env");
    writeFileSync(required, Object.keys(fixture).join("\n") + "\n");
    writeFileSync(
      file,
      Object.entries({ ...fixture, ...overrides })
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n",
    );
    const args = [
      join(root, "infra/validate-prod-env.sh"),
      "--required-file",
      required,
      "--env-file",
      file,
    ];
    if (second) {
      const overlay = join(dir, "overlay.env");
      writeFileSync(
        overlay,
        Object.entries(second)
          .map(([key, value]) => `${key}=${value}`)
          .join("\n") + "\n",
      );
      args.push("--env-file", overlay);
    }
    return spawnSync("bash", args, {
      encoding: "utf8",
      env: { ...process.env, ...fixture },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("production key preflight accepts independent stable keys and a safe version", () => {
  const result = validate();
  assert.equal(result.status, 0, result.stderr);
  for (const secret of Object.values(fixture).slice(0, 3))
    assert.equal((result.stdout + result.stderr).includes(secret), false);
});
for (const key of [
  "AUTH_FLOW_PROXY_SECRET",
  "ADVERTISING_RECIPIENT_HMAC_SECRET",
]) {
  for (const value of [
    "",
    "too-short",
    "replace-with-independent-random-example-value",
    "space " + "x".repeat(32),
    fixture.AUTH_JWT_SECRET,
  ]) {
    test(`preflight rejects invalid ${key} (${value ? (value === fixture.AUTH_JWT_SECRET ? "JWT reuse" : value.slice(0, 10)) : "empty"}) without printing its value`, () => {
      const result = validate({ [key]: value });
      assert.equal(result.status, 1);
      assert.match(result.stderr, new RegExp(key));
      if (value)
        assert.equal((result.stdout + result.stderr).includes(value), false);
    });
  }
}
test("production proxy and recipient keys cannot be equal", () => {
  const result = validate({
    ADVERTISING_RECIPIENT_HMAC_SECRET: fixture.AUTH_FLOW_PROXY_SECRET,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr.includes(fixture.AUTH_FLOW_PROXY_SECRET), false);
});
for (const version of ["bad version", "v".repeat(33), "v/1"]) {
  test(`preflight rejects malformed recipient key version (${version.length} characters)`, () => {
    assert.equal(
      validate({ ADVERTISING_RECIPIENT_KEY_VERSION: version }).status,
      1,
    );
  });
}
test("later env overlay wins without executing shell content", () => {
  const marker = join(tmpdir(), `artmate-env-must-not-execute-${process.pid}`);
  const result = validate(
    { AUTH_FLOW_PROXY_SECRET: "too-short" },
    {
      AUTH_FLOW_PROXY_SECRET: fixture.AUTH_FLOW_PROXY_SECRET,
      ADVERTISING_RECIPIENT_KEY_VERSION: `$(touch ${marker})`,
    },
  );
  assert.equal(result.status, 1);
  assert.equal(existsSync(marker), false);
  assert.equal(
    validate({ AUTH_FLOW_PROXY_SECRET: "too-short" }, fixture).status,
    0,
  );
});
