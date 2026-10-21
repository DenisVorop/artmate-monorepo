import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/deploy.yml", import.meta.url), "utf8");
// Earlier steps can also contain SSH blocks (for example Telegram transport).
const deployStep = workflow.split(/^      - name: /m).find((step) => step.startsWith("Deploy\n"));
assert.ok(deployStep, "The named Deploy step must be found");
const deployScript = deployStep.match(/ssh "\$PRODUCTION_USER@\$PRODUCTION_HOST" '\n(\s+set -eu\n[\s\S]*?)\n\s*'/)?.[1];
assert.ok(deployScript, "Production remote deployment script must be found");

// Execute the actual remote shell block with in-memory command doubles.
// No SSH, Docker, database access or filesystem changes are performed.
function runDeployment(failAt = "") {
  return spawnSync("bash", ["-c", `
    cd() { test "$1" = /opt/artmate; }
    docker() {
      printf '%s\\n' "$*"
      if [ -n "$DEPLOY_TEST_FAIL_AT" ] && [[ "$*" == *"$DEPLOY_TEST_FAIL_AT"* ]]; then
        return 42
      fi
    }
    bash() {
      printf 'backup %s\\n' "$*"
      if [ "$DEPLOY_TEST_FAIL_AT" = backup ]; then return 42; fi
      test "$1" = infra/backup-database.sh
    }
    ${deployScript}
  `], { encoding: "utf8", env: { ...process.env, DEPLOY_TEST_FAIL_AT: failAt } });
}

test("production stops API writers before migrating and only then starts the release", () => {
  const result = runDeployment();
  assert.equal(result.status, 0, result.stderr);
  const commands = result.stdout.trim().split("\n");
  assert.match(commands[0], / pull$/);
  assert.match(commands[1], / up -d postgres$/);
  assert.match(commands[2], / stop --timeout 120 api$/);
  assert.match(commands[3], /^backup infra\/backup-database\.sh --env-file \.env --env-file \.image\.env --output \/opt\/artmate-backups\/pre-migrate-.+\.dump$/);
  assert.match(commands[4], / --profile migrate run --rm api-migrate$/);
  assert.match(commands[5], / up -d --remove-orphans --wait --wait-timeout 120$/);
  assert.match(commands[6], / exec -T caddy /);
  assert.equal(commands.filter((command) => command.includes(" stop ")).length, 1);
});

for (const [failure, forbidden] of [
  [" pull", " stop "],
  [" stop --timeout 120 api", "backup infra/backup-database.sh"],
  ["backup", " run --rm api-migrate"],
  [" run --rm api-migrate", " up -d --remove-orphans"],
  [" up -d --remove-orphans", " exec -T caddy"],
]) {
  test(`production aborts after failure of ${failure.trim()}`, () => {
    const result = runDeployment(failure);
    assert.equal(result.status, 42, result.stderr);
    assert.ok(!result.stdout.includes(forbidden), result.stdout);
    assert.ok(!result.stdout.includes("image prune"));
  });
}
