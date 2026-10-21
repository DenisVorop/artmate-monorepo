import "reflect-metadata";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PrismaService } from "../src/prisma/prisma.service";
import { PasswordHasher } from "../src/auth/password-hasher";
import { CredentialsAuthService } from "../src/auth/credentials-auth.service";
import { CustomerDirectoryReader } from "../src/auth/customer-directory.reader";
import { AuthFlowStore } from "../src/auth/flow.store";
import { PasswordFlowService } from "../src/auth/password-flow.service";
import { LoginThrottleService } from "../src/auth/login-throttle.service";
import { AuthCompletionService } from "../src/auth/completion.service";
import { FlowCredentials } from "../src/auth/flow-credentials";
import { OrderActivationService } from "../src/auth/order-activation.service";
import { PasswordResetService } from "../src/auth/password-reset.service";
import { UsersService } from "../src/users/users.service";
import { CustomerProfileCommandHandler } from "../src/users/customer-profile-command.handler";
import { ConsentDecisionCommandHandler } from "../src/consents/consent-decision-command.handler";
import { EmailAdvertisingService } from "../src/consents/email-advertising.service";
import { UnsubscribeTokenIssuer } from "../src/consents/unsubscribe-token-issuer.service";
import { NotificationQueueService } from "../src/notifications/notification-queue.service";
import { MailerService } from "../src/mailer/mailer.service";
import { RequestEvidenceCapture } from "../src/common/request-evidence-capture";

const adminUrl = process.env.ARTMATE_AUTH_TEST_DATABASE_URL;
const password = "isolated-backup-fixture-password";
const email = "backup-restore@example.test";
const context = RequestEvidenceCapture.from({
  method: "POST",
  originalUrl: "/auth/flow/complete",
  httpVersion: "1.1",
  rawHeaders: [
    "User-Agent",
    "Полный браузер Artmate backup fixture",
    "X-Context",
    "first",
    "X-Context",
    "second",
    "Cookie",
    "never-retain-cookie",
  ],
  headers: {},
  socket: {
    remoteAddress: "127.0.0.1",
    remotePort: 40001,
    localAddress: "127.0.0.1",
    localPort: 3002,
  },
});

describe(
  "auth and consent native PostgreSQL backup/restore",
  { skip: !adminUrl },
  () => {
    it(
      "restores the actual private backup into a new database with facts, bytes, password, guest order and reusable withdrawal intact",
      { timeout: 120_000 },
      async () => {
        const parsed = new URL(adminUrl!);
        assert.ok(
          ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname),
          "Only an explicitly supplied local test PostgreSQL is allowed",
        );
        assert.ok(
          parsed.port && parsed.port !== "5432",
          "Use a dedicated non-default local test port",
        );
        const dumpPath = _executable("pg_dump");
        const restorePath = _executable("pg_restore");
        const pgBin = dirname(dumpPath);
        assert.equal(dirname(restorePath), pgBin);
        const fixtureEnvKeys = [
          "AUTH_JWT_SECRET",
          "AUTH_PASSWORD_RESET_SECRET",
          "ADVERTISING_RECIPIENT_HMAC_SECRET",
          "ADVERTISING_RECIPIENT_KEY_VERSION",
          "SITE_URL",
          "AUTH_PASSWORD_EMAIL",
          "AUTH_PASSWORD",
          "AUTH_PASSWORD_HASH",
        ];
        const previousEnv = new Map(
          fixtureEnvKeys.map((key) => [key, process.env[key]]),
        );
        const suffix = crypto.randomUUID().replace(/-/g, "");
        const sourceName = `auth_backup_source_${suffix}`;
        const targetName = `auth_backup_target_${suffix}`;
        const admin = new Pool({ connectionString: adminUrl });
        const directory = await mkdtemp(
          resolve(tmpdir(), "artmate-auth-backup-"),
        );
        let source: PrismaClient | undefined;
        let target: PrismaClient | undefined;
        let sourcePool: Pool | undefined;
        let targetPool: Pool | undefined;
        try {
          // These fixture values belong only to this isolated test process. No
          // production env files, GitHub secrets or working databases are read.
          process.env.AUTH_JWT_SECRET = "isolated-backup-jwt-secret";
          process.env.AUTH_PASSWORD_RESET_SECRET =
            "isolated-backup-reset-secret";
          process.env.ADVERTISING_RECIPIENT_HMAC_SECRET =
            "isolated-backup-recipient-secret-at-least-32-bytes";
          process.env.ADVERTISING_RECIPIENT_KEY_VERSION = "backup-fixture-v1";
          process.env.SITE_URL = "http://localhost:9";
          delete process.env.AUTH_PASSWORD_EMAIL;
          delete process.env.AUTH_PASSWORD;
          delete process.env.AUTH_PASSWORD_HASH;
          await admin.query(
            `CREATE DATABASE "${sourceName}" TEMPLATE template0`,
          );
          await admin.query(
            `CREATE DATABASE "${targetName}" TEMPLATE template0`,
          );
          const sourceUrl = _databaseUrl(parsed, sourceName);
          const targetUrl = _databaseUrl(parsed, targetName);
          sourcePool = new Pool({ connectionString: sourceUrl });
          targetPool = new Pool({ connectionString: targetUrl });
          const migrations = resolve(__dirname, "../prisma/migrations");
          for (const entry of (
            await readdir(migrations, { withFileTypes: true })
          )
            .filter((value) => value.isDirectory())
            .sort((a, b) => a.name.localeCompare(b.name)))
            await sourcePool.query(
              await readFile(
                resolve(migrations, entry.name, "migration.sql"),
                "utf8",
              ),
            );
          source = new PrismaClient({
            adapter: new PrismaPg(sourcePool, { disposeExternalPool: true }),
          });
          target = new PrismaClient({
            adapter: new PrismaPg(targetPool, { disposeExternalPool: true }),
          });
          const user = await source.user.create({
            data: {
              email,
              name: "Backup buyer",
              phone: "+79990000000",
              emailVerifiedAt: new Date(),
            },
          });
          const account = await source.authAccount.create({
            data: {
              userId: user.id,
              provider: "CREDENTIALS",
              providerUserId: email,
              providerEmail: email,
              credential: {
                create: { passwordHash: await PasswordHasher.create(password) },
              },
            },
            include: { credential: true },
          });
          const revisions = await _revisions(source);
          await _grant(source, revisions);
          const subscription =
            await source.emailAdvertisingSubscription.findUniqueOrThrow({
              where: { email },
            });
          const oldToken = await new UnsubscribeTokenIssuer(
            source as PrismaService,
          ).issue(subscription.id);
          await new EmailAdvertisingService(source as PrismaService).revoke(
            email,
            { actorUserId: user.id, source: "notification_settings", context },
          );
          await _guestPurchase(source);
          const acceptance =
            await source.requiredConsentAcceptance.findFirstOrThrow();
          await source.partnerApplication.create({
            data: {
              name: "Backup application",
              email: "reply@example.test",
              preferredContact: "EMAIL",
              channelUrl: "https://example.test/channel",
              partnerType: "CREATOR",
              audienceSize: "UP_TO_1000",
              authenticatedUserId: user.id,
              consentAcceptanceId: acceptance.id,
            },
          });
          const sourceRows = await _rows(sourcePool);
          const sourceSchema = await _schema(sourcePool);
          assert.equal(
            (sourceRows.email_advertising_consent_events as unknown[]).length,
            2,
          );
          assert.equal(
            (sourceRows.auth_completion_operations as unknown[]).length,
            1,
          );
          assert.equal(
            (sourceRows.ensure_customer_profile_commands as unknown[]).length,
            1,
          );
          assert.equal(
            JSON.stringify(
              sourceRows.email_advertising_unsubscribe_tokens,
            ).includes(oldToken),
            false,
          );
          assert.equal(
            JSON.stringify(sourceRows.verified_identity_facts).includes(
              "never-retain-cookie",
            ),
            false,
          );

          const fakeBin = resolve(directory, "bin");
          await _dockerAdapter(fakeBin);
          const envFile = resolve(directory, "fixture database.env");
          await writeFile(
            envFile,
            `POSTGRES_DB=${sourceName}\nPOSTGRES_USER=${decodeURIComponent(parsed.username)}\nPOSTGRES_PASSWORD=${decodeURIComponent(parsed.password)}\n`,
            { mode: 0o600 },
          );
          const archive = resolve(directory, "private", "database.dump");
          const repo = resolve(__dirname, "../../..");
          const backupScript = resolve(repo, "infra/backup-database.sh");
          const commandEnv = _environment(new URL(sourceUrl), fakeBin, pgBin);
          const backup = spawnSync(
            "/bin/bash",
            [backupScript, "--env-file", envFile, "--output", archive],
            {
              env: commandEnv,
              encoding: "utf8",
              timeout: 60_000,
              maxBuffer: 16 * 1024 * 1024,
            },
          );
          assert.equal(backup.status, 0, backup.stderr);
          const bytes = await readFile(archive);
          assert.equal(bytes.subarray(0, 5).toString(), "PGDMP");
          assert.equal((await stat(archive)).mode & 0o777, 0o600);
          assert.equal((await stat(dirname(archive))).mode & 0o777, 0o700);
          const checksum = crypto
            .createHash("sha256")
            .update(bytes)
            .digest("hex");
          assert.ok(backup.stdout.includes(checksum));
          const repeated = spawnSync(
            "/bin/bash",
            [backupScript, "--env-file", envFile, "--output", archive],
            { env: commandEnv, encoding: "utf8", timeout: 60_000 },
          );
          assert.notEqual(repeated.status, 0);
          assert.equal(
            crypto
              .createHash("sha256")
              .update(await readFile(archive))
              .digest("hex"),
            checksum,
          );
          assert.equal(
            (await readdir(dirname(archive))).some((name) =>
              name.startsWith(".database-backup."),
            ),
            false,
          );

          const restored = spawnSync(
            restorePath,
            [
              "--single-transaction",
              "--exit-on-error",
              "--no-owner",
              "--no-privileges",
              `--dbname=${targetName}`,
            ],
            {
              env: _environment(new URL(targetUrl), fakeBin, pgBin),
              input: bytes,
              encoding: "utf8",
              timeout: 60_000,
              maxBuffer: 16 * 1024 * 1024,
            },
          );
          assert.equal(restored.status, 0, restored.stderr);
          assert.deepEqual(
            await _rows(targetPool),
            sourceRows,
            "Every restored public row, JSON value, bytea/hash and relation snapshot must match",
          );
          assert.deepEqual(
            await _schema(targetPool),
            sourceSchema,
            "Checks, FKs, views and non-internal triggers must survive restore",
          );
          const credential = await target.authCredential.findUniqueOrThrow({
            where: { accountId: account.id },
          });
          assert.equal(
            await PasswordHasher.verify(password, credential.passwordHash),
            true,
          );
          assert.equal(
            await PasswordHasher.verify("incorrect", credential.passwordHash),
            false,
          );
          assert.equal(
            credential.passwordHash,
            account.credential!.passwordHash,
          );
          const read = await new EmailAdvertisingService(
            target as PrismaService,
          ).read(email);
          assert.deepEqual(read, { email, subscribed: false, version: 2 });
          assert.equal(
            (await target.order.findFirstOrThrow()).userId,
            (await source.order.findFirstOrThrow()).userId,
          );
          assert.equal(
            (
              await target.user.findUniqueOrThrow({
                where: { email: "guest-backup@example.test" },
              })
            ).emailVerifiedAt,
            null,
          );
          for (const revision of await target.consentRevision.findMany()) {
            assert.equal(
              crypto
                .createHash("sha256")
                .update(revision.documentBytes)
                .digest("hex"),
              revision.documentSha256,
            );
            assert.equal(
              crypto
                .createHash("sha256")
                .update(revision.formSnapshotBytes)
                .digest("hex"),
              revision.formSha256,
            );
          }
          const retainedToken =
            await target.emailAdvertisingUnsubscribeToken.findFirstOrThrow();
          await assert.rejects(
            targetPool.query(
              "INSERT INTO email_advertising_unsubscribe_tokens (id, subscription_id, token_hash) VALUES ($1,$2,$3)",
              [crypto.randomUUID(), subscription.id, retainedToken.tokenHash],
            ),
            { code: "23505" },
          );
          await assert.rejects(
            target.consentRevision.create({
              data: {
                ...revisions.personal,
                id: crypto.randomUUID(),
                version: "invalid-hash-fixture",
                documentSha256: "0".repeat(64),
              },
            }),
            /consent_revision_artifacts/,
          );
          await assert.rejects(
            target.requiredConsentAcceptance.update({
              where: { id: acceptance.id },
              data: { source: "forged-after-restore" },
            }),
          );
          await assert.rejects(
            target.emailAdvertisingUnsubscribeToken.create({
              data: { subscriptionId: "missing", tokenHash: "a".repeat(64) },
            }),
          );
          await assert.rejects(
            target.emailAdvertisingSubscription.update({
              where: { id: subscription.id },
              data: { state: "ACTIVE" },
            }),
          );
          // An old private link remains a revoke-only capability after restore and
          // after a real new Auth/Consents/Users grant with the same stable key.
          const advertising = new EmailAdvertisingService(
            target as PrismaService,
          );
          await advertising.unsubscribe(oldToken, {
            source: "email_unsubscribe",
            context,
          });
          await _grant(target, revisions);
          assert.equal((await advertising.read(email)).subscribed, true);
          await advertising.unsubscribe(oldToken, {
            source: "email_one_click",
            context,
          });
          assert.deepEqual(await advertising.read(email), {
            email,
            subscribed: false,
            version: 4,
          });
          assert.equal(await target.emailAdvertisingConsentEvent.count(), 4);
          assert.equal(await target.user.count(), 2);
          assert.equal(await target.order.count(), 1);
          assert.equal(
            (
              await target.authCredential.findUniqueOrThrow({
                where: { accountId: account.id },
              })
            ).passwordHash,
            credential.passwordHash,
          );
        } finally {
          for (const [key, value] of previousEnv) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
          }
          await source?.$disconnect();
          await target?.$disconnect();
          if (sourcePool && !sourcePool.ended) await sourcePool.end();
          if (targetPool && !targetPool.ended) await targetPool.end();
          try {
            await admin.query(
              `DROP DATABASE IF EXISTS "${sourceName}" WITH (FORCE)`,
            );
            await admin.query(
              `DROP DATABASE IF EXISTS "${targetName}" WITH (FORCE)`,
            );
          } finally {
            await admin.end();
            await rm(directory, { recursive: true, force: true });
          }
        }
      },
    );
  },
);

function _databaseUrl(admin: URL, name: string): string {
  const url = new URL(admin);
  url.pathname = `/${name}`;
  return url.toString();
}
function _executable(name: "pg_dump" | "pg_restore"): string {
  const result = spawnSync("/bin/sh", ["-c", `command -v ${name}`], {
    encoding: "utf8",
  });
  assert.equal(
    result.status,
    0,
    `${name} must be installed and available in PATH`,
  );
  const executable = result.stdout.trim();
  assert.ok(
    executable.startsWith("/"),
    `${name} must resolve to an absolute path`,
  );
  return executable;
}
function _environment(
  url: URL,
  fakeBin: string,
  pgBin: string,
): NodeJS.ProcessEnv {
  return {
    PATH: `${fakeBin}:${pgBin}:/usr/bin:/bin`,
    PGHOST: url.hostname,
    PGPORT: url.port,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    POSTGRES_USER: decodeURIComponent(url.username),
    POSTGRES_PASSWORD: decodeURIComponent(url.password),
    POSTGRES_DB: url.pathname.slice(1),
    ARTMATE_NATIVE_PG_BIN: pgBin,
    LANG: "C",
  };
}
async function _dockerAdapter(directory: string): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(directory, { mode: 0o700 });
  const file = resolve(directory, "docker");
  await writeFile(
    file,
    `#!/bin/bash
set -euo pipefail
[ "$1" = compose ] || exit 91
shift
while [ "\${1-}" = --env-file ]; do [ -f "$2" ] || exit 92; shift 2; done
[ "\${1-}" = -f ] && [[ "$2" = */docker-compose.prod.yml ]] || exit 93
shift 2
[ "\${1-}" = exec ] && [ "\${2-}" = -T ] && [ "\${3-}" = postgres ] || exit 94
shift 3
if [ "\${1-}" = sh ] && [ "\${2-}" = -ec ] && [ "$#" = 3 ]; then
  for required in 'PGPASSWORD="$POSTGRES_PASSWORD"' 'exec pg_dump --no-password --format=custom' '--no-owner --no-privileges --lock-wait-timeout=60s' '--username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'; do
    [[ "$3" = *"$required"* ]] || exit 95
  done
  exec "$ARTMATE_NATIVE_PG_BIN/pg_dump" --no-password --format=custom --no-owner --no-privileges --lock-wait-timeout=60s --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"
elif [ "\${1-}" = pg_restore ] && [ "\${2-}" = --file=/dev/null ] && [ "$#" = 2 ]; then
  exec "$ARTMATE_NATIVE_PG_BIN/pg_restore" --file=/dev/null
fi
exit 96
`,
    { mode: 0o700 },
  );
  await chmod(file, 0o700);
}
async function _rows(pool: Pool): Promise<Record<string, unknown>> {
  const tables = await pool.query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
  );
  const snapshot: Record<string, unknown> = {};
  for (const { tablename } of tables.rows) {
    const table = tablename.replaceAll('"', '""');
    snapshot[tablename] = (
      await pool.query<{ rows: unknown }>(
        `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb) AS rows FROM "${table}" t`,
      )
    ).rows[0]!.rows;
  }
  return snapshot;
}
async function _schema(pool: Pool) {
  return {
    constraints: (
      await pool.query(
        "SELECT conrelid::regclass::text AS relation, conname, contype, pg_get_constraintdef(oid,true) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY relation,conname",
      )
    ).rows.map((constraint: { definition: string }) => ({
      ...constraint,
      // pg_dump/restore reparses varchar[]::text[] as per-element casts.
      // Canonicalize only that equivalent representation, preserving all checks.
      definition: constraint.definition.replace(
        /ARRAY\[([^\]]+)\]::text\[\]/g,
        (_match: string, elements: string) =>
          `ARRAY[${elements.replace(/::character varying/g, "::character varying::text")}]`,
      ),
    })),
    triggers: (
      await pool.query(
        "SELECT c.relname AS relation,t.tgname,pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname",
      )
    ).rows,
    views: (
      await pool.query(
        "SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname",
      )
    ).rows,
  };
}
async function _revisions(db: PrismaClient) {
  const result = [];
  const publishedAt = new Date(Date.now() - 1000);
  for (const kind of ["PERSONAL_DATA", "EMAIL_ADVERTISING"] as const) {
    const documentBytes = Buffer.concat([
      Buffer.from("%PDF-1.4 Fixture only: русский текст\n"),
      Buffer.from([0, 255, 128]),
      Buffer.from(kind),
    ]);
    const formSnapshotBytes = Buffer.from(
      `<form>Тестовая форма ${kind}: byte-for-byte</form>`,
    );
    result.push(
      await db.consentRevision.create({
        data: {
          kind,
          purpose: "site_auth",
          version: "backup-fixture-v1",
          documentTitle: `Fixture ${kind}`,
          documentBytes,
          formSnapshotBytes,
          documentSha256: crypto
            .createHash("sha256")
            .update(documentBytes)
            .digest("hex"),
          formSha256: crypto
            .createHash("sha256")
            .update(formSnapshotBytes)
            .digest("hex"),
          createdAt: publishedAt,
          publishedAt,
        },
      }),
    );
  }
  return { personal: result[0]!, advertising: result[1]! };
}
async function _grant(
  db: PrismaClient,
  revisions: Awaited<ReturnType<typeof _revisions>>,
) {
  const prisma = db as PrismaService;
  const users = new UsersService(prisma);
  const credentials = new CredentialsAuthService(prisma, users);
  const directory = new CustomerDirectoryReader();
  const store = new AuthFlowStore(directory, credentials);
  const passwordFlow = new PasswordFlowService(
    prisma,
    directory,
    store,
    new LoginThrottleService(prisma),
    credentials,
  );
  const completion = new AuthCompletionService(
    prisma,
    store,
    directory,
    credentials,
  );
  const started = await passwordFlow.start({ email, password }, context);
  const state = await db.userConsentState.findUnique({ where: { email } });
  const subscription = await db.emailAdvertisingSubscription.findUnique({
    where: { email },
  });
  const submitted = await completion.submit(
    started.credentials,
    {
      operationKey: crypto.randomUUID(),
      expectedStateRevision: state?.revision ?? 0,
      expectedAdvertisingVersion: subscription?.version ?? 0,
      decisions: [
        { revisionId: revisions.personal.id, accepted: true },
        { revisionId: revisions.advertising.id, accepted: true },
      ],
      source: "backup_restore_fixture",
    },
    context,
  );
  assert.equal(submitted.status, "PENDING");
  const flow = await db.authPendingFlow.findUniqueOrThrow({
    where: {
      capabilityHash: FlowCredentials.capabilityHash(started.credentials),
    },
  });
  const operationId = flow.currentOperationId!;
  const consent = await db.applyConsentDecisionCommand.findUniqueOrThrow({
    where: { operationId },
  });
  await new ConsentDecisionCommandHandler(prisma).process(consent.id);
  assert.equal(
    (
      await db.applyConsentDecisionCommand.findUniqueOrThrow({
        where: { id: consent.id },
      })
    ).status,
    "COMPLETED",
  );
  await completion.process(operationId);
  const profile = await db.ensureCustomerProfileCommand.findUniqueOrThrow({
    where: { operationId },
  });
  await new CustomerProfileCommandHandler(prisma, users).process(profile.id);
  await completion.process(operationId);
  const completed = await completion.advance(started.credentials, context);
  assert.equal(completed?.status, "COMPLETED");
}
async function _guestPurchase(db: PrismaClient) {
  const prisma = db as PrismaService;
  const users = new UsersService(prisma);
  const credentials = new CredentialsAuthService(prisma, users);
  const mailer = new MailerService();
  mailer.sendMail = async () => {
    assert.fail("External delivery must never run in a restore test");
  };
  const queue = new NotificationQueueService(mailer, prisma);
  // Outbox writes are real; automatic external dispatch is the isolated boundary.
  queue.processDueJobs = async () => undefined;
  const reset = new PasswordResetService(credentials, queue, prisma);
  const activation = new OrderActivationService(
    mailer,
    queue,
    reset,
    prisma,
    users,
  );
  const order = await db.order.create({
    data: {
      id: crypto.randomBytes(16).toString("hex"),
      cartId: "backup-guest-cart",
      customerEmail: "guest-backup@example.test",
      customerName: "Guest buyer",
      customerPhone: "+79990000001",
      pickupPointId: "point",
      pickupPointTitle: "Point",
      pickupPointAddress: "Address",
      pickupPointWorkHours: "9-18",
      deliveryPrice: 0,
      itemsCount: 1,
      subtotal: 100,
      total: 100,
      paymentRedirectUrl: "https://example.test/payment",
    },
  });
  const userId = await db.$transaction((tx) =>
    activation.attachGuestOrderInTransaction(tx, order),
  );
  assert.ok(userId);
  assert.equal(await db.authOrderActivationToken.count(), 1);
}
