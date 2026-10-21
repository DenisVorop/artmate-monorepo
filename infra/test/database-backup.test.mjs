import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = resolve(import.meta.dirname, "../..");

function runBackup(mode = "", setup = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "artmate-backup-test-"));
  const envFile = join(dir, "fixture.env");
  const output = join(dir, "private snapshots", "database.dump");
  writeFileSync(envFile, "POSTGRES_PASSWORD=not-executed-fixture\n");
  writeFileSync(
    join(dir, "docker"),
    `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.BACKUP_TEST_COMMANDS, JSON.stringify(args)+'\\n');
if (args.includes('pg_restore')) {
  const data = fs.readFileSync(0);
  if (process.env.BACKUP_TEST_MODE === 'restore-failure') process.exit(43);
  if (process.env.BACKUP_TEST_MODE === 'race') fs.writeFileSync(process.env.BACKUP_TEST_OUTPUT, 'concurrent-complete-backup');
  if (process.env.BACKUP_TEST_MODE === 'directory-race') fs.mkdirSync(process.env.BACKUP_TEST_OUTPUT);
  if (!data.toString().startsWith('PGDMP')) process.exit(44);
} else {
  if (process.env.BACKUP_TEST_MODE !== 'empty') process.stdout.write('PGDMP-synthetic-archive');
  if (process.env.BACKUP_TEST_MODE === 'dump-failure') process.exit(42);
}
`,
    { mode: 0o700 },
  );
  setup({ dir, output, envFile });
  const result = spawnSync(
    "bash",
    [
      join(root, "infra/backup-database.sh"),
      "--env-file",
      envFile,
      "--output",
      output,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        BACKUP_TEST_MODE: mode,
        BACKUP_TEST_OUTPUT: output,
        BACKUP_TEST_COMMANDS: join(dir, "commands"),
      },
    },
  );
  return {
    ...result,
    dir,
    output,
    clean: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("backup publishes a private checked archive through the current Compose postgres service", () => {
  const result = runBackup();
  try {
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(result.output, "utf8"),
      "PGDMP-synthetic-archive",
    );
    assert.equal(statSync(result.output).mode & 0o777, 0o600);
    assert.equal(
      statSync(join(result.dir, "private snapshots")).mode & 0o777,
      0o700,
    );
    const commands = readFileSync(join(result.dir, "commands"), "utf8")
      .trim()
      .split("\n")
      .map(JSON.parse);
    assert.equal(commands.length, 2);
    assert.deepEqual(commands[0].slice(0, 4), [
      "compose",
      "--env-file",
      join(result.dir, "fixture.env"),
      "-f",
    ]);
    assert.ok(commands[0].includes(join(root, "docker-compose.prod.yml")));
    assert.match(commands[0].at(-1), /pg_dump --no-password --format=custom/);
    assert.match(commands[0].at(-1), /--no-owner --no-privileges/);
    assert.match(commands[0].at(-1), /\$POSTGRES_PASSWORD/);
    assert.ok(commands[1].includes("--file=/dev/null"));
    assert.match(result.stdout, /SHA-256: [a-f0-9]{64}/);
    assert.equal(result.stdout.includes("PGDMP"), false);
    assert.deepEqual(readdirSync(join(result.dir, "private snapshots")), [
      "database.dump",
    ]);
  } finally {
    result.clean();
  }
});

for (const [mode, expected] of [
  ["dump-failure", 42],
  ["restore-failure", 43],
  ["empty", 1],
]) {
  test(`backup failure (${mode}) leaves no published or partial archive`, () => {
    const result = runBackup(mode);
    try {
      assert.equal(result.status, expected, result.stderr);
      assert.equal(existsSync(result.output), false);
      assert.deepEqual(readdirSync(join(result.dir, "private snapshots")), []);
      assert.equal(result.stdout.includes("Database backup verified"), false);
    } finally {
      result.clean();
    }
  });
}

test("concurrent publication cannot overwrite a completed backup", () => {
  const result = runBackup("race");
  try {
    assert.notEqual(result.status, 0);
    assert.equal(
      readFileSync(result.output, "utf8"),
      "concurrent-complete-backup",
    );
    assert.deepEqual(readdirSync(join(result.dir, "private snapshots")), [
      "database.dump",
    ]);
  } finally {
    result.clean();
  }
});

test("concurrent directory publication cannot turn the target into an unchecked archive directory", () => {
  const result = runBackup("directory-race");
  try {
    assert.notEqual(result.status, 0);
    assert.ok(statSync(result.output).isDirectory());
    assert.deepEqual(readdirSync(result.output), []);
    assert.equal(result.stdout.includes("Database backup verified"), false);
  } finally {
    result.clean();
  }
});

test("backup rejects existing files and symlinks before invoking Docker", () => {
  for (const link of [false, true]) {
    const dir = mkdtempSync(join(tmpdir(), "artmate-backup-existing-"));
    try {
      const target = join(dir, "existing");
      writeFileSync(target, "existing");
      const output = join(dir, "output");
      if (link) symlinkSync(target, output);
      else writeFileSync(output, "original");
      const check = spawnSync(
        "bash",
        [
          join(root, "infra/backup-database.sh"),
          "--env-file",
          target,
          "--output",
          output,
        ],
        { encoding: "utf8" },
      );
      assert.equal(check.status, 1, check.stderr);
      assert.equal(
        readFileSync(output, "utf8"),
        link ? "existing" : "original",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("backup requires explicit env and absolute destination", () => {
  for (const args of [
    [],
    ["--output", "relative.dump"],
    ["--env-file", "/missing", "--output", "/tmp/unused.dump"],
  ]) {
    const result = spawnSync(
      "bash",
      [join(root, "infra/backup-database.sh"), ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2);
  }
});
