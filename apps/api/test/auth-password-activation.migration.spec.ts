import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import type { RequestEvidenceV1 } from "../src/common/request-evidence";

// Real PostgreSQL migrations in memory; no DATABASE_URL, HTTP or external email.
describe("password and order activation persistence", () => {
  let db: PGlite;
  let legacySnapshot: unknown;
  let refusedUnprovenOperations = false;

  before(async () => {
    db = new PGlite();
    const root = resolve(__dirname, "../prisma/migrations");
    for (const entry of (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const sql = await readFile(
        resolve(root, entry.name, "migration.sql"),
        "utf8",
      );
      if (entry.name === "20261020160000_password_activation_contracts") {
        await db.exec(_legacySql());
        legacySnapshot = await _legacySnapshot(db);
        await db.exec(`BEGIN;
          INSERT INTO verified_identity_facts (id, email, method, source_id, verified_at, request_context)
          VALUES ('old-proof', 'legacy@example.test', 'email_code', 'old-code', CURRENT_TIMESTAMP, ${_contextSql()});
          INSERT INTO auth_completion_operations (id, flow_id, operation_key, payload_hash, identity_fact_id, purpose)
          VALUES ('old-operation', 'old-flow', 'key', repeat('a',64), 'old-proof', 'site_auth')`);
        await assert.rejects(db.exec(sql), { code: "55000" });
        await db.exec("ROLLBACK");
        assert.deepEqual(
          (
            await db.query(
              "SELECT to_regclass('auth_authentication_facts') AS table_name",
            )
          ).rows,
          [{ table_name: null }],
        );
        refusedUnprovenOperations = true;
      }
      await db.exec(sql);
    }
  });
  after(async () => db?.close());
  beforeEach(async () => db.exec("BEGIN"));
  afterEach(async () => db.exec("ROLLBACK"));

  it("preserves users, credentials, orders and unused activation links without backfill", async () => {
    assert.deepEqual(await _legacySnapshot(db), legacySnapshot);
    assert.equal(refusedUnprovenOperations, true);
    for (const table of [
      "auth_authentication_facts",
      "auth_pending_flows",
      "verified_identity_facts",
      "email_advertising_subscriptions",
    ]) {
      assert.deepEqual(
        (await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows,
        [{ count: 0 }],
      );
    }
  });

  it("keeps a historical verified date separate from fresh password authentication", async () => {
    await _passwordProof(db);
    assert.deepEqual(
      (
        await db.query(`SELECT i.method AS verification_method,
      i.verified_at < a.authenticated_at AS historical, a.method AS login_method,
      a.auth_version, a.account_id_snapshot, a.request_context
      FROM verified_identity_facts i JOIN auth_authentication_facts a ON a.identity_fact_id = i.id`)
      ).rows,
      [
        {
          verification_method: "recorded_email_verification",
          historical: true,
          login_method: "password",
          auth_version: 2,
          account_id_snapshot: "legacy-account",
          request_context: _context(),
        },
      ],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM auth_email_challenges",
        )
      ).rows,
      [{ count: 0 }],
    );
  });

  it("requires credential version, actor and structured request metadata for password facts", async () => {
    await _passwordProof(db);
    for (const [column, value] of [
      ["credential_updated_at", "NULL"],
      ["account_id_snapshot", "NULL"],
      ["auth_version", "NULL"],
      ["auth_version", "-1"],
      ["request_context", "'{}'::jsonb"],
    ]) {
      await _reject(
        db,
        `INSERT INTO auth_authentication_facts
        SELECT 'invalid', contract_version, identity_fact_id, method, 'invalid-source',
          ${column === "user_id_snapshot" ? value : "user_id_snapshot"},
          ${column === "account_id_snapshot" ? value : "account_id_snapshot"},
          ${column === "auth_version" ? value : "auth_version"},
          ${column === "credential_updated_at" ? value : "credential_updated_at"}, authenticated_at,
          ${column === "request_context" ? value : "request_context"}, created_at, env_credential_binding_snapshot FROM auth_authentication_facts`,
        "23514",
      );
    }
    await _reject(
      db,
      _authenticationSql(
        "wrong-user",
        "password",
        "another-user",
        "legacy-account",
        "CURRENT_TIMESTAMP - INTERVAL '1 day'",
      ),
      "23514",
    );
  });

  it("does not authenticate before the email proof and does not use a link as a registration code", async () => {
    await _proof(db, "email_code");
    await _reject(
      db,
      _authenticationSql("future-proof", "email_registration").replace(
        "CURRENT_TIMESTAMP,",
        "CURRENT_TIMESTAMP - INTERVAL '1 day',",
      ),
      "23514",
    );
    await _reject(
      db,
      _authenticationSql("wrong-method", "order_activation", "guest"),
      "23514",
    );
  });

  it("deduplicates immutable authentication facts and retains them after account deletion", async () => {
    await _passwordProof(db);
    await _reject(
      db,
      _authenticationSql(
        "auth",
        "password",
        "legacy",
        "legacy-account",
        "CURRENT_TIMESTAMP - INTERVAL '1 day'",
      ),
      "23505",
    );
    await _reject(
      db,
      "UPDATE auth_authentication_facts SET auth_version = 3",
      "55000",
    );
    await _reject(db, "DELETE FROM auth_authentication_facts", "55000");
    await db.exec("DELETE FROM users WHERE id = 'legacy'");
    assert.equal(
      (await db.query("SELECT * FROM auth_authentication_facts")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("SELECT * FROM verified_identity_facts")).rows.length,
      1,
    );
  });

  it("binds pending flow to authentication, actor, browser and immutable expiry", async () => {
    await _registration(db);
    await _flow(db);
    for (const change of [
      "user_id_snapshot = 'guest'",
      "browser_binding_hash = repeat('c',64)",
      "capability_hash = repeat('c',64)",
      "expires_at = expires_at + INTERVAL '1 minute'",
      "purpose = 'another'",
    ]) {
      await _reject(db, `UPDATE auth_pending_flows SET ${change}`, "23514");
    }
    await _reject(
      db,
      `INSERT INTO auth_pending_flows
      (id, capability_hash, browser_binding_hash, identity_fact_id, authentication_fact_id, purpose, expires_at)
      SELECT 'duplicate', repeat('c',64), browser_binding_hash, identity_fact_id, authentication_fact_id, purpose, expires_at FROM auth_pending_flows`,
      "23505",
    );
  });

  it("accepts only a complete bounded password hash draft without activating credentials", async () => {
    await _registration(db);
    await _flow(db);
    for (const change of [
      "credential_password_hash = 'plain-password'",
      `credential_password_hash = ${_hashSql()}`,
      `credential_password_hash = ${_hashSql()}, credential_expires_at = expires_at + INTERVAL '1 minute', credential_operation_key = 'key'`,
    ]) {
      await _reject(db, `UPDATE auth_pending_flows SET ${change}`, "23514");
    }
    await _draft(db);
    await _reject(
      db,
      "UPDATE auth_pending_flows SET status = 'expired', finished_at = CURRENT_TIMESTAMP",
      "23514",
    );
    assert.equal(
      (
        await db.query(
          "SELECT credential_password_hash FROM auth_pending_flows",
        )
      ).rows.length,
      1,
    );
    assert.deepEqual(await _legacySnapshot(db), legacySnapshot);
    assert.deepEqual(
      (await db.query("SELECT count(*)::int AS count FROM auth_sessions")).rows,
      [{ count: 0 }],
    );
  });

  it("rejects a new password draft on an ordinary password login", async () => {
    await _passwordProof(db);
    await _flow(db, "legacy");
    await _reject(db, _draftSql(), "23514");
  });

  it("freezes the draft hash, expiry and operation key, but clears it on closure", async () => {
    await _registration(db);
    await _flow(db);
    await _draft(db);
    for (const change of [
      "credential_password_hash = replace(credential_password_hash, 'a', 'c')",
      "credential_expires_at = credential_expires_at + INTERVAL '1 second'",
      "credential_operation_key = 'other-key'",
      "credential_password_hash = NULL, credential_expires_at = NULL, credential_operation_key = NULL",
    ]) {
      await _reject(db, `UPDATE auth_pending_flows SET ${change}`, "23514");
    }
    await db.exec(
      "UPDATE auth_pending_flows SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, credential_password_hash = NULL, credential_expires_at = NULL, credential_operation_key = NULL",
    );
    await _reject(
      db,
      "UPDATE auth_pending_flows SET status = 'open', finished_at = NULL",
      "23514",
    );
    await _reject(db, _draftSql(), "23514");
  });

  it("binds completion to the same authentication and the frozen credential operation key", async () => {
    await _registration(db);
    await _flow(db);
    await _draft(db);
    await db.exec(_operationSql("other-key"));
    await _reject(
      db,
      "UPDATE auth_pending_flows SET current_operation_id = 'operation', status = 'completing'",
      "23514",
    );
    await _reject(
      db,
      "UPDATE auth_completion_operations SET authentication_fact_id = 'another'",
      "55000",
    );
    await db.exec(_operationSql("key", "matching-operation"));
    await db.exec(
      "UPDATE auth_pending_flows SET current_operation_id = 'matching-operation', status = 'completing'",
    );
    await _reject(
      db,
      "UPDATE auth_pending_flows SET current_operation_id = 'operation'",
      "23514",
    );
    await _reject(db, "UPDATE auth_pending_flows SET status = 'open'", "23514");
  });

  it("rejects completion from a different authentication of the same exact email", async () => {
    await _registration(db);
    await _flow(db);
    await db.exec(
      _authenticationSql("another-auth").replace(
        "'activation-token'",
        "'another-registration'",
      ),
    );
    await db.exec(_operationSql().replace("'auth'", "'another-auth'"));
    await _reject(
      db,
      "UPDATE auth_pending_flows SET current_operation_id = 'operation', status = 'completing'",
      "23514",
    );
  });

  it("does not let a credential draft outlive its flow or arrive already expired", async () => {
    await _registration(db);
    await _flow(db);
    await _reject(
      db,
      _draftSql().replace(
        "CURRENT_TIMESTAMP + INTERVAL '5 minutes'",
        "CURRENT_TIMESTAMP - INTERVAL '1 second'",
      ),
      "23514",
    );
    await _reject(
      db,
      _draftSql().replace(
        "CURRENT_TIMESTAMP + INTERVAL '5 minutes'",
        "expires_at + INTERVAL '1 second'",
      ),
      "23514",
    );
  });

  it("stores an activation password only in its temporary flow while retaining the guest order", async () => {
    await _activation(db);
    await _draft(db);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM auth_credentials c JOIN auth_accounts a ON a.id = c.account_id WHERE a.user_id = 'guest'",
        )
      ).rows,
      [{ count: 0 }],
    );
    assert.deepEqual(
      (await db.query("SELECT user_id FROM orders WHERE id = 'guest-order'"))
        .rows,
      [{ user_id: "guest" }],
    );
    assert.deepEqual(
      (await db.query("SELECT count(*)::int AS count FROM auth_sessions")).rows,
      [{ count: 0 }],
    );
  });

  it("exchanges a consumed activation link into exactly one same-user browser flow", async () => {
    await _activation(db);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    assert.deepEqual(
      (
        await db.query(
          "SELECT user_id_snapshot, activation_token_id_snapshot FROM auth_pending_flows",
        )
      ).rows,
      [
        {
          user_id_snapshot: "guest",
          activation_token_id_snapshot: "activation-token",
        },
      ],
    );
    assert.deepEqual(
      (await db.query("SELECT user_id FROM orders WHERE id = 'guest-order'"))
        .rows,
      [{ user_id: "guest" }],
    );
    assert.deepEqual(
      (
        await db.query(
          "UPDATE auth_order_activation_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = 'activation-token' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP RETURNING id",
        )
      ).rows,
      [],
    );
    await _reject(
      db,
      "UPDATE auth_pending_flows SET browser_binding_hash = repeat('c',64)",
      "23514",
    );
    await _reject(
      db,
      `INSERT INTO auth_pending_flows
      SELECT 'replay', repeat('c',64), repeat('d',64), identity_fact_id, purpose, user_id_snapshot, profile_revision,
        draft_name, draft_phone, status, current_operation_id, expires_at, finished_at, created_at, updated_at,
        authentication_fact_id, credential_password_hash, credential_expires_at, credential_operation_key,
        activation_token_id_snapshot, activation_token_expires_at FROM auth_pending_flows`,
      "23505",
    );
  });

  it("rejects an unconsumed, expired or wrong-owner activation token atomically", async () => {
    for (const mutation of [
      "consumed_at = NULL",
      "expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second'",
      "user_id = 'legacy'",
    ]) {
      await db.exec("SAVEPOINT invalid_exchange");
      await _activation(db);
      await db.exec(
        `UPDATE auth_order_activation_tokens SET ${mutation} WHERE id = 'activation-token'`,
      );
      await assert.rejects(db.exec("SET CONSTRAINTS ALL IMMEDIATE"), {
        code: "23514",
      });
      await db.exec(
        "ROLLBACK TO SAVEPOINT invalid_exchange; RELEASE SAVEPOINT invalid_exchange",
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT count(*)::int AS count FROM auth_pending_flows",
          )
        ).rows,
        [{ count: 0 }],
      );
      assert.deepEqual(
        (await db.query("SELECT consumed_at FROM auth_order_activation_tokens"))
          .rows,
        [{ consumed_at: null }],
      );
    }
  });

  it("retains link proof and operation evidence after temporary token/flow cleanup", async () => {
    await _activation(db);
    await db.exec("SET CONSTRAINTS ALL IMMEDIATE");
    await db.exec(_operationSql());
    await db.exec(
      "DELETE FROM auth_pending_flows; DELETE FROM auth_order_activation_tokens; DELETE FROM users WHERE id = 'guest'",
    );
    for (const table of [
      "verified_identity_facts",
      "auth_authentication_facts",
      "auth_completion_operations",
    ]) {
      assert.equal((await db.query(`SELECT * FROM ${table}`)).rows.length, 1);
    }
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

function _context(): RequestEvidenceV1 {
  return {
    version: 1,
    capturedAt: "2026-10-20T10:00:00Z",
    source: "direct_request",
    http: { method: "POST", url: "/auth/flow", version: "1.1" },
    headers: { "user-agent": ["Browser"], origin: ["https://artmate.example"] },
    query: {},
    connection: {
      remoteAddress: "127.0.0.1",
      remotePort: 12345,
      localAddress: "127.0.0.1",
      localPort: 3002,
      encrypted: false,
    },
    client: {
      ipAddress: "127.0.0.1",
      forwardedFor: [],
      forwardedHeadersTrusted: false,
    },
  };
}

function _contextSql(): string {
  return `'${JSON.stringify(_context())}'::jsonb`;
}
function _hashSql(): string {
  return "'scrypt:' || repeat('a',32) || ':' || repeat('b',128)";
}

async function _proof(
  db: PGlite,
  method = "email_code",
  user: string | null = null,
  verifiedAt = "CURRENT_TIMESTAMP",
): Promise<void> {
  await db.exec(`INSERT INTO verified_identity_facts (id, email, method, source_id, user_id_snapshot, verified_at, request_context)
    VALUES ('proof', '${user === "legacy" ? "legacy" : "guest"}@example.test', '${method}', 'activation-token', ${user ? `'${user}'` : "NULL"}, ${verifiedAt}, ${_contextSql()})`);
}

function _authenticationSql(
  id = "auth",
  method = "email_registration",
  user: string | null = null,
  account: string | null = null,
  credentialDate = "NULL",
): string {
  return `INSERT INTO auth_authentication_facts (id, identity_fact_id, method, source_id, user_id_snapshot,
    account_id_snapshot, auth_version, credential_updated_at, authenticated_at, request_context)
    VALUES ('${id}', 'proof', '${method}', 'activation-token', ${user ? `'${user}'` : "NULL"}, ${account ? `'${account}'` : "NULL"},
      ${user ? 2 : "NULL"}, ${credentialDate}, CURRENT_TIMESTAMP, ${_contextSql()})`;
}

async function _registration(db: PGlite): Promise<void> {
  await _proof(db);
  await db.exec(_authenticationSql());
}
async function _passwordProof(db: PGlite): Promise<void> {
  await _proof(
    db,
    "recorded_email_verification",
    "legacy",
    "CURRENT_TIMESTAMP - INTERVAL '30 days'",
  );
  await db.exec(
    _authenticationSql(
      "auth",
      "password",
      "legacy",
      "legacy-account",
      "CURRENT_TIMESTAMP - INTERVAL '1 day'",
    ),
  );
}

async function _flow(
  db: PGlite,
  user: string | null = null,
  activation = false,
): Promise<void> {
  await db.exec(`INSERT INTO auth_pending_flows (id, capability_hash, browser_binding_hash, identity_fact_id,
    authentication_fact_id, user_id_snapshot, purpose, expires_at, activation_token_id_snapshot, activation_token_expires_at)
    VALUES ('flow', repeat('a',64), repeat('b',64), 'proof', 'auth', ${user ? `'${user}'` : "NULL"}, 'site_auth',
      CURRENT_TIMESTAMP + INTERVAL '10 minutes', ${activation ? "'activation-token', (SELECT expires_at FROM auth_order_activation_tokens WHERE id = 'activation-token')" : "NULL, NULL"})`);
}

function _draftSql(): string {
  return `UPDATE auth_pending_flows SET credential_password_hash = ${_hashSql()},
    credential_expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes', credential_operation_key = 'key'`;
}
async function _draft(db: PGlite): Promise<void> {
  await db.exec(_draftSql());
}

function _operationSql(key = "key", id = "operation"): string {
  return `INSERT INTO auth_completion_operations (id, flow_id, operation_key, payload_hash, identity_fact_id, authentication_fact_id, purpose)
    VALUES ('${id}', 'flow', '${key}', repeat('a',64), 'proof', 'auth', 'site_auth')`;
}

async function _activation(db: PGlite): Promise<void> {
  await db.exec(
    "UPDATE auth_order_activation_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = 'activation-token' AND consumed_at IS NULL AND expires_at > CURRENT_TIMESTAMP",
  );
  await _proof(db, "order_activation_link", "guest");
  await db.exec(_authenticationSql("auth", "order_activation", "guest"));
  await _flow(db, "guest", true);
}

function _legacySql(): string {
  return `INSERT INTO users (id, email, email_verified_at, auth_version) VALUES
    ('legacy', 'legacy@example.test', CURRENT_TIMESTAMP - INTERVAL '30 days', 2), ('guest', 'guest@example.test', NULL, 2);
    INSERT INTO auth_accounts (id, user_id, provider, provider_user_id) VALUES ('legacy-account', 'legacy', 'credentials', 'legacy@example.test');
    INSERT INTO auth_credentials (id, account_id, password_hash) VALUES ('legacy-credential', 'legacy-account', ${_hashSql()});
    INSERT INTO auth_order_activation_tokens (id, user_id, token_hash, expires_at)
      VALUES ('activation-token', 'guest', repeat('a',64), CURRENT_TIMESTAMP + INTERVAL '1 day');
    INSERT INTO orders (id, user_id, cart_id, customer_name, customer_phone, customer_email, pickup_point_id,
      pickup_point_title, pickup_point_address, pickup_point_work_hours, delivery_price, payment_redirect_url, items_count, subtotal, total)
      VALUES ('guest-order', 'guest', 'guest-cart', 'Guest', '+79990000000', 'guest@example.test', 'point', 'Point', 'Address', 'Hours', 0, '/payment', 1, 100, 100);`;
}

async function _legacySnapshot(db: PGlite): Promise<unknown> {
  const result: unknown[] = [];
  for (const table of [
    "users",
    "auth_accounts",
    "auth_credentials",
    "orders",
    "auth_order_activation_tokens",
  ]) {
    // Later prize migrations add delivery funding; compare the original order data.
    const query = table === "orders"
      ? "SELECT to_jsonb(o) - 'sponsored_delivery_price' AS data FROM orders o ORDER BY id"
      : `SELECT * FROM ${table} ORDER BY id`;
    result.push((await db.query(query)).rows);
  }
  return result;
}
