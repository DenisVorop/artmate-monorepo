import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import type { RequestEvidenceV1 } from "../src/common/request-evidence";

// Real migrations in an isolated PostgreSQL engine. Never uses DATABASE_URL.
describe("auth and consent persistence", () => {
  let db: PGlite;

  before(async () => {
    db = new PGlite();
    await db.exec("SET TIME ZONE 'UTC'");
    const root = resolve(__dirname, "../prisma/migrations");
    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === "20261020120000_auth_consent_contracts") {
        await db.exec(
          "INSERT INTO users (id, email) VALUES ('legacy', 'legacy@example.test')",
        );
      }
      await db.exec(
        await readFile(resolve(root, entry.name, "migration.sql"), "utf8"),
      );
    }
  });
  after(async () => db?.close());
  beforeEach(async () => {
    await db.exec("BEGIN");
    // Each contract case supplies its own document fixtures.
    await db.exec("TRUNCATE consent_revisions CASCADE");
    await _seedIdentity(db);
  });
  afterEach(async () => {
    await db.exec("ROLLBACK");
  });

  it("retains an immutable staged submission and its terminal result", async () => {
    await db.exec(`INSERT INTO contests (id, slug, title, description, task, rules, prize, prize_detail, winners_count, opens_at, closes_at, draw_at, updated_at)
      VALUES ('staged-contest', 'staged-contest', 'Конкурс', 'Описание', 'Фото', ARRAY['Правила'], 'Приз', 'Описание', 1, now() - interval '1 day', now() + interval '1 day', now() + interval '2 days', now());
      INSERT INTO contest_entry_submissions (id, contest_id, user_id, entry_id, public_id, offer_id, consent_command_id, revision, data, stored_keys)
      VALUES ('staged', 'staged-contest', 'test-actor', 'future-entry', 'future-public-id', 'future-offer', 'future-command', 1, '{"photoSha256":"original"}', ARRAY['retained-photo']);`);
    await _reject(
      db,
      `UPDATE contest_entry_submissions SET data = '{"photoSha256":"replacement"}' WHERE id = 'staged'`,
      "55000",
    );
    await db.exec(
      `UPDATE contest_entry_submissions SET status = 'COMPLETED', finished_at = now() WHERE id = 'staged'`,
    );
    await _reject(
      db,
      `UPDATE contest_entry_submissions SET status = 'PENDING', finished_at = NULL WHERE id = 'staged'`,
      "55000",
    );
    await _reject(
      db,
      `DELETE FROM contest_entry_submissions WHERE id = 'staged'`,
      "55000",
    );
  });
  it("publishes the initial documents without enrolling existing users, and can safely run again", async () => {
    const migration = await readFile(
      resolve(
        __dirname,
        "../prisma/migrations/20261022090000_publish_initial_auth_consents/migration.sql",
      ),
      "utf8",
    );
    await db.exec(migration);
    const revisions = (
      await db.query<{
        kind: string;
        document_bytes: Uint8Array;
        form_snapshot_bytes: Uint8Array;
        published: boolean;
      }>(
        "SELECT kind, document_bytes, form_snapshot_bytes, published_at IS NOT NULL AS published FROM consent_revisions ORDER BY kind",
      )
    ).rows;
    assert.equal(revisions.length, 2);
    for (const row of revisions) {
      const name =
        row.kind === "personal_data" ? "personal-data" : "advertising";
      assert.deepEqual(
        Buffer.from(row.document_bytes),
        await readFile(
          resolve(
            __dirname,
            `../../site/public/documents/legal/${name}-consent-2026-09-22.pdf`,
          ),
        ),
      );
      assert.equal(
        Buffer.from(row.form_snapshot_bytes).subarray(0, 4).toString("hex"),
        "504b0304",
      );
      assert.equal(row.published, true);
    }
    await db.exec(migration);
    assert.deepEqual(
      (await db.query("SELECT count(*)::int AS count FROM consent_revisions"))
        .rows,
      [{ count: 2 }],
    );
    for (const table of [
      "required_consent_acceptances",
      "email_advertising_subscriptions",
      "user_consent_states",
    ]) {
      assert.deepEqual(
        (await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows,
        [{ count: 0 }],
      );
    }
    assert.deepEqual(
      (
        await db.query(
          "SELECT email_verified_at FROM users WHERE id = 'legacy'",
        )
      ).rows,
      [{ email_verified_at: null }],
    );
  });

  it("preserves already published document revisions during initial publication", async () => {
    await _seedRevisions(db);
    const before = (
      await db.query(
        "SELECT id,kind,purpose,version,document_sha256,form_sha256,published_at,retired_at FROM consent_revisions ORDER BY id",
      )
    ).rows;
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20261022090000_publish_initial_auth_consents/migration.sql",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT id,kind,purpose,version,document_sha256,form_sha256,published_at,retired_at FROM consent_revisions ORDER BY id",
        )
      ).rows,
      before,
    );
  });

  it("publishes existing Users profiles without changing their email confirmation or consent", async () => {
    assert.deepEqual(
      (
        await db.query(
          "SELECT profile_revision, name, phone FROM customer_auth_directory_v1 WHERE user_id = 'legacy'",
        )
      ).rows,
      [{ profile_revision: 1, name: null, phone: null }],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT email_verified_at FROM users WHERE id = 'legacy'",
        )
      ).rows,
      [{ email_verified_at: null }],
    );
    assert.equal(
      (
        await db.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM required_consent_acceptances",
        )
      ).rows[0]!.count,
      0,
    );
  });

  it("retains full structured request metadata and requires a versioned context", async () => {
    await _seedRevisions(db);
    await db.exec(_acceptanceSql());
    assert.deepEqual(
      (
        await db.query<{ request_context: RequestEvidenceV1 }>(
          "SELECT request_context FROM required_consent_acceptances",
        )
      ).rows[0]!.request_context,
      _context(),
    );
    assert.deepEqual(
      (
        await db.query<{ request_context: RequestEvidenceV1 }>(
          "SELECT request_context FROM verified_identity_facts",
        )
      ).rows[0]!.request_context,
      _context(),
    );
    await _reject(
      db,
      _acceptanceSql("person@example.test", "invalid-context").replace(
        _contextSql(),
        "'{}'::jsonb",
      ),
      "23514",
    );
    await _reject(
      db,
      "UPDATE required_consent_acceptances SET request_context = '{}'",
      "55000",
    );
  });

  it("rejects raw codes, invalid attempt counters and impossible expiry", async () => {
    await db.exec(_challengeSql());
    await _reject(
      db,
      "UPDATE auth_email_challenges SET code_hash = '123456'",
      "23514",
    );
    await _reject(
      db,
      "UPDATE auth_email_challenges SET failed_attempts = 6",
      "23514",
    );
    await _reject(
      db,
      "UPDATE auth_email_challenges SET failed_attempts = -1",
      "23514",
    );
    await _reject(
      db,
      "UPDATE auth_email_challenges SET expires_at = created_at",
      "23514",
    );
  });

  it("deduplicates identity and completion and prevents rewriting the verified email", async () => {
    await _reject(
      db,
      `INSERT INTO verified_identity_facts (id, email, method, source_id, verified_at, request_context) VALUES ('duplicate', 'other@example.test', 'email_code', 'challenge', CURRENT_TIMESTAMP, ${_contextSql()})`,
      "23505",
    );
    await _reject(
      db,
      "UPDATE verified_identity_facts SET email = 'other@example.test'",
      "55000",
    );
    await _reject(db, "DELETE FROM verified_identity_facts", "55000");
    await _reject(
      db,
      "INSERT INTO auth_completion_operations (id, flow_id, operation_key, payload_hash, identity_fact_id, authentication_fact_id, purpose) SELECT 'duplicate', flow_id, operation_key, payload_hash, identity_fact_id, authentication_fact_id, purpose FROM auth_completion_operations",
      "23505",
    );
    await _reject(
      db,
      "UPDATE auth_completion_operations SET purpose = 'other'",
      "55000",
    );
  });

  it("binds pending capabilities to their own operation and identity", async () => {
    await db.exec(`INSERT INTO auth_pending_flows
      (id, capability_hash, browser_binding_hash, identity_fact_id, authentication_fact_id, purpose, expires_at)
      VALUES ('flow', repeat('a', 64), repeat('b', 64), 'identity', 'authentication', 'site_auth', CURRENT_TIMESTAMP + INTERVAL '10 minutes')`);
    await db.exec(
      "UPDATE auth_pending_flows SET status = 'completing', current_operation_id = 'operation'",
    );
    await _reject(
      db,
      "UPDATE auth_pending_flows SET purpose = 'other'",
      "23514",
    );
    await _reject(
      db,
      "UPDATE auth_pending_flows SET status = 'completed'",
      "23514",
    );
  });

  it("keeps exact immutable document/form bytes and verifies both hashes", async () => {
    await _seedRevisions(db);
    await _reject(
      db,
      "UPDATE consent_revisions SET document_bytes = convert_to('changed', 'UTF8')",
      "55000",
    );
    await _reject(
      db,
      "UPDATE consent_revisions SET form_snapshot_bytes = convert_to('changed', 'UTF8')",
      "55000",
    );
    await _reject(
      db,
      "UPDATE consent_revisions SET published_at = NULL",
      "55000",
    );
    await _reject(db, "DELETE FROM consent_revisions", "55000");
    await _reject(
      db,
      `INSERT INTO consent_revisions
      (id, kind, purpose, version, document_title, document_bytes, document_sha256, form_snapshot_bytes, form_sha256)
      VALUES ('bad-hash', 'personal_data', 'site_auth', '2', 'Document', convert_to('doc', 'UTF8'), repeat('0',64), convert_to('form', 'UTF8'), repeat('0',64))`,
      "23514",
    );
  });

  it("records the accepted revision and optional source while keeping facts immutable", async () => {
    await _seedRevisions(db);
    await db.exec(_acceptanceSql());
    assert.deepEqual(
      (
        await db.query(
          "SELECT email, revision_id, purpose, source FROM required_consent_acceptances",
        )
      ).rows,
      [
        {
          email: "person@example.test",
          revision_id: "pd",
          purpose: "site_auth",
          source: null,
        },
      ],
    );
    await _reject(
      db,
      "UPDATE required_consent_acceptances SET source = 'auth_form'",
      "55000",
    );
    await _reject(
      db,
      _acceptanceSql("other@example.test", "unrelated-email"),
      "23514",
    );
    await _seedSubscription(db);
    await db.exec(_grantSql("person@example.test", "account_notifications"));
    await db.exec(
      "UPDATE email_advertising_subscriptions SET state = 'active', version = 1, active_grant_id = 'grant'",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT action, revision_id, source FROM email_advertising_consent_events",
        )
      ).rows,
      [
        {
          action: "granted",
          revision_id: "ads",
          source: "account_notifications",
        },
      ],
    );
    await _reject(
      db,
      "UPDATE email_advertising_consent_events SET source = 'auth_form'",
      "55000",
    );
  });

  it("rejects unpublished, retired and wrong-kind acceptance revisions", async () => {
    await _seedRevisions(db, false);
    await _reject(db, _acceptanceSql(), "23514");
    await db.exec(
      "UPDATE consent_revisions SET published_at = CURRENT_TIMESTAMP",
    );
    await _reject(
      db,
      _acceptanceSql("person@example.test", "wrong-kind", "ads"),
      "23514",
    );
    await db.exec(
      "UPDATE consent_revisions SET retired_at = CURRENT_TIMESTAMP",
    );
    await _reject(db, _acceptanceSql(), "23514");
  });

  it("allows advertising only for a matching verified email and advertising revision", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _reject(db, _grantSql("other@example.test"), "23514");
    await _reject(db, _grantSql().replace("'ads'", "'pd'"), "23514");
    await _reject(db, _grantSql().replace("'identity'", "NULL"), "23514");
    await _grant(db);
    await _reject(
      db,
      "UPDATE email_advertising_consent_events SET email = 'other@example.test'",
      "55000",
    );
    await _reject(
      db,
      "UPDATE email_advertising_subscriptions SET email = 'other@example.test'",
      "23514",
    );
  });

  it("records a settings grant from the active verified account without Auth or required-consent evidence", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _seedSettingsUsers(db);
    await db.exec(_settingsGrantSql());

    assert.deepEqual(
      (
        await db.query(
          `SELECT action, auth_operation_id, identity_fact_id, actor_user_id_snapshot,
                  email, revision_id, source, email_verified_at_snapshot
           FROM email_advertising_consent_events`,
        )
      ).rows,
      [
        {
          action: "granted",
          auth_operation_id: null,
          identity_fact_id: null,
          actor_user_id_snapshot: "settings-user",
          email: "person@example.test",
          revision_id: "ads",
          source: "notification_settings",
          email_verified_at_snapshot: (
            await db.query<{ email_verified_at: Date }>(
              "SELECT email_verified_at FROM users WHERE id = 'settings-user'",
            )
          ).rows[0]!.email_verified_at,
        },
      ],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM required_consent_acceptances",
        )
      ).rows,
      [{ count: 0 }],
    );

    await _reject(db, "SET CONSTRAINTS ALL IMMEDIATE", "23514");
    await db.exec(
      `UPDATE email_advertising_subscriptions
       SET state = 'active', version = 1, active_grant_id = 'settings-grant'
       WHERE id = 'subscription'`,
    );
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    assert.deepEqual(
      (
        await db.query(
          "SELECT state, version, active_grant_id FROM email_advertising_subscriptions WHERE id = 'subscription'",
        )
      ).rows,
      [{ state: "active", version: 1, active_grant_id: "settings-grant" }],
    );
  });

  it("rejects settings grants with invalid provenance, authentication binding or verification snapshots", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _seedSettingsUsers(db);

    for (const sql of [
      _settingsGrantSql({ source: "profile" }),
      _settingsGrantSql({ source: null }),
      _settingsGrantSql({
        authOperationId: "operation",
        identityFactId: "identity",
      }),
      _settingsGrantSql({ actorUserId: "other-user" }),
      _settingsGrantSql({ email: "other@example.test" }),
      _settingsGrantSql({
        emailVerifiedAt: "CURRENT_TIMESTAMP - INTERVAL '2 minutes'",
      }),
      _settingsGrantSql({
        emailVerifiedAt: "CURRENT_TIMESTAMP + INTERVAL '1 minute'",
      }),
    ]) {
      await _reject(db, sql, "23514");
    }

    await db.exec(
      "UPDATE email_advertising_subscriptions SET email = 'unverified@example.test' WHERE id = 'subscription'",
    );
    await _reject(
      db,
      _settingsGrantSql({
        actorUserId: "unverified-user",
        email: "unverified@example.test",
      }),
      "23514",
    );
  });

  it("requires a current published advertising revision for a settings grant", async () => {
    await _seedSubscription(db);
    await _seedSettingsUsers(db);
    await _seedRevisions(db, false);
    await _reject(db, _settingsGrantSql(), "23514");

    await db.exec(
      "UPDATE consent_revisions SET published_at = CURRENT_TIMESTAMP",
    );
    await _reject(db, _settingsGrantSql({ revisionId: "pd" }), "23514");

    await db.exec(
      "UPDATE consent_revisions SET retired_at = CURRENT_TIMESTAMP WHERE id = 'ads'",
    );
    await _reject(db, _settingsGrantSql(), "23514");
  });

  it("keeps settings grant evidence immutable", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _seedSettingsUsers(db);
    await db.exec(_settingsGrantSql());

    await _reject(
      db,
      "UPDATE email_advertising_consent_events SET email_verified_at_snapshot = CURRENT_TIMESTAMP",
      "55000",
    );
    await _reject(db, "DELETE FROM email_advertising_consent_events", "55000");
  });

  it("requires grant and authoritative permission to commit atomically", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await db.exec(_grantSql());
    await _reject(db, "SET CONSTRAINTS ALL IMMEDIATE", "23514");
    await db.exec(
      "UPDATE email_advertising_subscriptions SET state = 'active', version = 1, active_grant_id = 'grant' WHERE id = 'subscription'",
    );
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    await _reject(
      db,
      "UPDATE email_advertising_subscriptions SET version = 2",
      "23514",
    );
  });

  it("requires revocation and permission to commit together and prevents restoring an old grant", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _grant(db);
    await db.exec(`INSERT INTO email_advertising_consent_events
      (id, subscription_id, version, operation_key, payload_hash, action, email, source, request_id, request_context)
      VALUES ('revoke', 'subscription', 2, 'revoke-key', repeat('f',64), 'revoked', 'person@example.test', 'unsubscribe_link', 'request', ${_contextSql()})`);
    await _reject(db, "SET CONSTRAINTS ALL IMMEDIATE", "23514");
    await db.exec(
      "UPDATE email_advertising_subscriptions SET state = 'revoked', version = 2, active_grant_id = NULL WHERE id = 'subscription'",
    );
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    await _reject(
      db,
      "UPDATE email_advertising_subscriptions SET state = 'active', version = 1, active_grant_id = 'grant'",
      "23514",
    );
  });

  it("persists deduplicated domain intents and checks results and identity binding", async () => {
    await db.exec(`INSERT INTO ensure_customer_profile_commands
      (id, operation_id, identity_fact_id, name, phone, payload_hash)
      VALUES ('profile-command', 'operation', 'identity', 'Имя', '+79990000000', repeat('a',64))`);
    await _reject(
      db,
      "UPDATE ensure_customer_profile_commands SET name = 'Someone else'",
      "55000",
    );
    await _reject(
      db,
      "UPDATE ensure_customer_profile_commands SET status = 'completed', result_user_id = 'user', processed_at = CURRENT_TIMESTAMP",
      "23514",
    );
    await _reject(
      db,
      `INSERT INTO ensure_customer_profile_commands
      (id, operation_id, identity_fact_id, name, phone, payload_hash)
      VALUES ('duplicate', 'operation', 'identity', 'Имя', '+79990000000', repeat('a',64))`,
      "23505",
    );
    for (const decisions of [
      '[{"revisionId":"ads","accepted":"true"}]',
      '[{"revisionId":"ads","accepted":null}]',
      '[{"revisionId":"ads","accepted":true},{"revisionId":"ads","accepted":false}]',
    ]) {
      await _reject(
        db,
        `INSERT INTO apply_consent_decision_commands
        (id, operation_id, identity_fact_id, expected_state_revision, expected_advertising_version, decisions,
         payload_hash, source, request_id, request_context)
        VALUES ('invalid-decision', 'operation', 'identity', 0, 0, '${decisions}',
         repeat('b',64), 'auth_form', 'request', ${_contextSql()})`,
        "23514",
      );
    }
    await db.exec(`INSERT INTO apply_consent_decision_commands
      (id, operation_id, identity_fact_id, expected_state_revision, expected_advertising_version, decisions,
       payload_hash, source, request_id, request_context)
      VALUES ('consent-command', 'operation', 'identity', 0, 0, '[{"revisionId":"ads","accepted":false}]',
       repeat('b',64), 'auth_form', 'request', ${_contextSql("trusted_site_proxy")})`);
    await _reject(
      db,
      "UPDATE apply_consent_decision_commands SET decisions = '[]'",
      "55000",
    );
    await _reject(
      db,
      "UPDATE apply_consent_decision_commands SET status = 'completed', processed_at = CURRENT_TIMESTAMP",
      "23514",
    );
    await db.exec(
      "UPDATE apply_consent_decision_commands SET status = 'completed', result_state_revision = 1, processed_at = CURRENT_TIMESTAMP",
    );
    await _reject(
      db,
      "UPDATE apply_consent_decision_commands SET status = 'pending', result_state_revision = NULL, processed_at = NULL",
      "55000",
    );
    await db.exec(
      `INSERT INTO verified_identity_facts (id, email, method, source_id, verified_at, request_context) VALUES ('other-identity', 'other@example.test', 'email_code', 'other-challenge', CURRENT_TIMESTAMP, ${_contextSql()})`,
    );
    await db.exec(
      "INSERT INTO auth_completion_operations (id, flow_id, operation_key, payload_hash, identity_fact_id, authentication_fact_id, purpose) VALUES ('other-operation', 'flow', 'other-key', repeat('a',64), 'identity', 'authentication', 'site_auth')",
    );
    await _reject(
      db,
      `INSERT INTO apply_consent_decision_commands
      (id, operation_id, identity_fact_id, expected_state_revision, expected_advertising_version, decisions,
       payload_hash, source, request_id, request_context)
      VALUES ('wrong-identity', 'other-operation', 'other-identity', 0, 0, '[{"revisionId":"ads","accepted":true}]',
       repeat('b',64), 'auth_form', 'request', ${_contextSql()})`,
      "23503",
    );
  });

  it("retains evidence after changing/deleting a user and cleaning temporary flow data", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _grant(db);
    await db.exec(_acceptanceSql());
    await db.exec(_challengeSql());
    await db.exec(`INSERT INTO users (id, email) VALUES ('user', 'person@example.test');
      INSERT INTO auth_pending_flows (id, capability_hash, browser_binding_hash, identity_fact_id, authentication_fact_id, purpose, expires_at)
      VALUES ('flow', repeat('a',64), repeat('b',64), 'identity', 'authentication', 'site_auth', CURRENT_TIMESTAMP + INTERVAL '10 minutes');
      UPDATE users SET email = 'changed@example.test' WHERE id = 'user';
      DELETE FROM users WHERE id = 'user';
      DELETE FROM auth_email_challenges;
      DELETE FROM auth_pending_flows;`);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM customer_profile_states WHERE user_id = 'user'",
        )
      ).rows.length,
      0,
    );
    for (const table of [
      "verified_identity_facts",
      "required_consent_acceptances",
      "email_advertising_consent_events",
    ]) {
      assert.deepEqual((await db.query(`SELECT email FROM ${table}`)).rows, [
        { email: "person@example.test" },
      ]);
    }
    await _reject(db, "DELETE FROM auth_completion_operations", "55000");
    await _reject(db, "DELETE FROM email_advertising_subscriptions", "23503");
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
  });

  it("binds delivery evidence to its exact grant recipient and preserves uncertain outcomes", async () => {
    await _seedRevisions(db);
    await _seedSubscription(db);
    await _grant(db);
    await db.exec(`INSERT INTO email_advertising_delivery_attempts
      (id, logical_send_id, attempt_number, lease_token, grant_event_id, email, sender, message_id, message_bytes, message_sha256)
      VALUES ('attempt', 'logical-send', 1, '11111111-1111-4111-8111-111111111111', 'grant',
        'person@example.test', 'sender@example.test', '<message@example.test>', convert_to('MIME snapshot', 'UTF8'),
        encode(sha256(convert_to('MIME snapshot', 'UTF8')), 'hex'))`);
    await _reject(
      db,
      "UPDATE email_advertising_delivery_attempts SET outcome = 'accepted'",
      "23514",
    );
    await _reject(
      db,
      "UPDATE email_advertising_delivery_attempts SET outcome = 'accepted', finished_at = CURRENT_TIMESTAMP, email = 'other@example.test'",
      "55000",
    );
    await _reject(
      db,
      `INSERT INTO email_advertising_delivery_attempts
      SELECT 'wrong-recipient', 'another-send', attempt_number, lease_token, grant_event_id, 'other@example.test', sender,
        message_id, message_bytes, message_sha256, outcome, provider_receipt_id, outcome_code, started_at, finished_at
      FROM email_advertising_delivery_attempts`,
      "23514",
    );
    await db.exec(
      "UPDATE email_advertising_delivery_attempts SET outcome = 'uncertain', outcome_code = 'smtp_timeout', finished_at = CURRENT_TIMESTAMP",
    );
    await _reject(
      db,
      "UPDATE email_advertising_delivery_attempts SET outcome = 'accepted', provider_receipt_id = 'late-receipt'",
      "55000",
    );
    await _reject(
      db,
      "DELETE FROM email_advertising_delivery_attempts",
      "55000",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT outcome FROM email_advertising_delivery_attempts",
        )
      ).rows,
      [{ outcome: "uncertain" }],
    );
  });

  it("retains deduplicated evidence-access audit independently of the admin account", async () => {
    await _seedSubscription(db);
    await db.exec(`INSERT INTO email_advertising_access_events
      (id, subscription_id, actor_user_id_snapshot, action, operation_key, reason, request_id, request_context)
      VALUES ('access', 'subscription', 'former-admin', 'evidence_export', 'export-operation', 'Recipient complaint', 'request', ${_contextSql()})`);
    await _reject(
      db,
      "UPDATE email_advertising_access_events SET actor_user_id_snapshot = 'other-admin'",
      "55000",
    );
    await _reject(db, "DELETE FROM email_advertising_access_events", "55000");
    await _reject(
      db,
      `INSERT INTO email_advertising_access_events
      (id, subscription_id, actor_user_id_snapshot, action, operation_key, reason, request_id, request_context)
      VALUES ('duplicate', 'subscription', 'former-admin', 'evidence_export', 'export-operation', 'Recipient complaint', 'request', ${_contextSql()})`,
      "23505",
    );
  });
});

async function _reject(db: PGlite, sql: string, code: string): Promise<void> {
  await db.exec("SAVEPOINT expected_rejection");
  try {
    await assert.rejects(db.exec(sql), { code });
  } finally {
    await db.exec(
      "ROLLBACK TO SAVEPOINT expected_rejection; RELEASE SAVEPOINT expected_rejection",
    );
  }
}

async function _seedIdentity(db: PGlite): Promise<void> {
  await db.exec(`INSERT INTO verified_identity_facts (id, email, method, source_id, verified_at, request_context)
    VALUES ('identity', 'person@example.test', 'email_code', 'challenge', CURRENT_TIMESTAMP, ${_contextSql()});
    INSERT INTO auth_authentication_facts (id, identity_fact_id, method, source_id, authenticated_at, request_context)
    VALUES ('authentication', 'identity', 'email_registration', 'registration', CURRENT_TIMESTAMP, ${_contextSql()});
    INSERT INTO auth_completion_operations (id, flow_id, operation_key, payload_hash, identity_fact_id, authentication_fact_id, purpose)
    VALUES ('operation', 'flow', 'operation-key', repeat('a',64), 'identity', 'authentication', 'site_auth')`);
}

async function _seedRevisions(db: PGlite, published = true): Promise<void> {
  await db.exec(`INSERT INTO consent_revisions
    (id, kind, purpose, version, document_title, document_bytes, document_sha256, form_snapshot_bytes, form_sha256, published_at)
    SELECT id, kind::consent_kind, 'site_auth', '1', 'Document', convert_to('document bytes', 'UTF8'),
      encode(sha256(convert_to('document bytes', 'UTF8')), 'hex'), convert_to('form bytes', 'UTF8'),
      encode(sha256(convert_to('form bytes', 'UTF8')), 'hex'), ${published ? "CURRENT_TIMESTAMP" : "NULL::timestamp"}
    FROM (VALUES ('pd', 'personal_data'), ('ads', 'email_advertising')) AS revisions(id, kind)`);
}

async function _seedSubscription(db: PGlite): Promise<void> {
  await db.exec(`INSERT INTO email_advertising_subscriptions (id, email, recipient_key, key_version)
    VALUES ('subscription', 'person@example.test', repeat('a',64), '1')`);
}

async function _seedSettingsUsers(db: PGlite): Promise<void> {
  await db.exec(`INSERT INTO users (id, email, email_verified_at)
      VALUES ('settings-user', 'person@example.test', CURRENT_TIMESTAMP - INTERVAL '1 minute'),
        ('other-user', 'other@example.test', CURRENT_TIMESTAMP - INTERVAL '1 minute'),
        ('unverified-user', 'unverified@example.test', NULL)`);
}

async function _grant(db: PGlite): Promise<void> {
  await db.exec(_grantSql());
  await db.exec(
    "UPDATE email_advertising_subscriptions SET state = 'active', version = 1, active_grant_id = 'grant' WHERE id = 'subscription'",
  );
}

function _grantSql(
  email = "person@example.test",
  source: string | null = null,
): string {
  return `INSERT INTO email_advertising_consent_events
    (id, subscription_id, version, operation_key, payload_hash, action, auth_operation_id, identity_fact_id,
      email, revision_id, source, request_id, request_context)
    VALUES ('grant', 'subscription', 1, 'grant-key', repeat('a',64), 'granted', 'operation', 'identity',
      '${email}', 'ads', ${source === null ? "NULL" : "'" + source.replaceAll("'", "''") + "'"}, 'request', ${_contextSql()})`;
}

function _settingsGrantSql(
  options: {
    actorUserId?: string;
    authOperationId?: string | null;
    email?: string;
    emailVerifiedAt?: string;
    identityFactId?: string | null;
    revisionId?: string;
    source?: string | null;
  } = {},
): string {
  const actorUserId = options.actorUserId ?? "settings-user";
  const authOperationId = options.authOperationId ?? null;
  const identityFactId = options.identityFactId ?? null;
  const email = options.email ?? "person@example.test";
  const revisionId = options.revisionId ?? "ads";
  const source =
    options.source === undefined ? "notification_settings" : options.source;
  const emailVerifiedAt =
    options.emailVerifiedAt ?? "CURRENT_TIMESTAMP - INTERVAL '1 minute'";
  const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

  return `INSERT INTO email_advertising_consent_events
    (id, subscription_id, version, operation_key, payload_hash, action, auth_operation_id, identity_fact_id,
      actor_user_id_snapshot, email, revision_id, source, request_id, request_context, email_verified_at_snapshot)
    VALUES ('settings-grant', 'subscription', 1, 'settings-grant-key', repeat('c',64), 'granted',
      ${authOperationId === null ? "NULL" : literal(authOperationId)},
      ${identityFactId === null ? "NULL" : literal(identityFactId)},
      ${literal(actorUserId)}, ${literal(email)}, ${literal(revisionId)},
      ${source === null ? "NULL" : literal(source)}, 'settings-request', ${_contextSql()}, ${emailVerifiedAt})`;
}

function _acceptanceSql(
  email = "person@example.test",
  id = "acceptance",
  revision = "pd",
): string {
  return `INSERT INTO required_consent_acceptances
    (id, operation_id, identity_fact_id, actor_user_id_snapshot, email, revision_id, purpose,
     request_id, request_context)
    VALUES ('${id}', 'operation', 'identity', 'user', '${email}', '${revision}', 'site_auth',
      'request', ${_contextSql()})`;
}

function _challengeSql(): string {
  return `INSERT INTO auth_email_challenges
    (id, email, code_hash, hash_key_version, nonce, browser_binding_hash, max_attempts, expires_at, resend_available_at)
    VALUES ('challenge', 'person@example.test', repeat('a',64), '1', 'random-nonce', repeat('b',64), 5,
      CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP + INTERVAL '1 minute')`;
}

function _context(
  source: RequestEvidenceV1["source"] = "direct_request",
): RequestEvidenceV1 {
  return {
    version: 1,
    capturedAt: "2026-10-20T10:00:00.000Z",
    source,
    http: {
      method: "POST",
      url: "/auth/flow/complete?source=checkout&source=contact",
      version: "1.1",
    },
    headers: {
      host: ["artmate.example"],
      "user-agent": [`Browser/${"version".repeat(100)}`],
      "accept-language": ["ru-RU,ru;q=0.9"],
      "x-forwarded-for": ["203.0.113.7"],
      origin: ["https://artmate.example"],
      referer: ["https://artmate.example/contact"],
    },
    query: { source: ["checkout", "contact"] },
    connection: {
      remoteAddress: "127.0.0.1",
      remotePort: 54321,
      localAddress: "127.0.0.1",
      localPort: 3002,
      encrypted: false,
    },
    client: {
      ipAddress: "127.0.0.1",
      forwardedFor: ["203.0.113.7"],
      forwardedHeadersTrusted: source === "trusted_site_proxy",
    },
  };
}

function _contextSql(
  source: RequestEvidenceV1["source"] = "direct_request",
): string {
  return `'${JSON.stringify(_context(source)).replaceAll("'", "''")}'::jsonb`;
}
