import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationsDirectory = resolve(__dirname, "../prisma/migrations");
const confirmationMigration = "20260915000000_confirm_analytics_delivery";

describe("analytics confirmation migration", () => {
  it("preserves accepted uploads without confirming or backfilling historical conversions", async () => {
    const db = await createLegacyDatabase();
    try {
      await applyConfirmationMigration(db);

      const events = await db.query(`
        SELECT id, event_type, aggregate_id, status, provider_upload_id,
               provider_response, provider_status, confirmed_at,
               to_char(sent_at, 'YYYY-MM-DD HH24:MI:SS.MS') AS sent_at
        FROM analytics_outbox_events
        ORDER BY id
      `);
      assert.deepEqual(events.rows, [{
        id: "legacy-paid",
        event_type: "order_paid",
        aggregate_id: "AM-HISTORICAL",
        status: "sent",
        provider_upload_id: "123456",
        provider_response: "accepted",
        provider_status: null,
        confirmed_at: null,
        sent_at: "2026-09-08 13:04:30.123",
      }]);

      const columns = await db.query(`
        SELECT column_name, data_type, is_nullable,
               character_maximum_length, datetime_precision
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'analytics_outbox_events'
          AND column_name IN ('confirmed_at', 'provider_status')
        ORDER BY column_name
      `);
      assert.deepEqual(columns.rows, [
        {
          column_name: "confirmed_at",
          data_type: "timestamp without time zone",
          is_nullable: "YES",
          character_maximum_length: null,
          datetime_precision: 3,
        },
        {
          column_name: "provider_status",
          data_type: "character varying",
          is_nullable: "YES",
          character_maximum_length: 32,
          datetime_precision: null,
        },
      ]);

      await assert.rejects(
        db.query(`
          INSERT INTO analytics_outbox_events
            (id, event_type, aggregate_id, payload)
          VALUES ('duplicate-paid', 'order_paid', 'AM-HISTORICAL', '{}')
        `),
        /unique constraint/i,
      );
    } finally {
      await db.close();
    }
  });

  it("supports a single accepted-event claim and fenced terminal confirmation after commit", async () => {
    const db = await createLegacyDatabase();
    try {
      await applyConfirmationMigration(db);

      const claim = `
        UPDATE analytics_outbox_events
        SET status = 'processing', lease_token = $1, locked_at = now()
        WHERE id = 'legacy-paid' AND status = 'sent'
          AND next_attempt_at <= now()
        RETURNING id
      `;
      const first = await db.query(claim, ["lease-a"]);
      const competing = await db.query(claim, ["lease-b"]);
      assert.deepEqual(first.rows, [{ id: "legacy-paid" }]);
      assert.deepEqual(competing.rows, []);

      const complete = `
        UPDATE analytics_outbox_events
        SET status = 'confirmed', provider_status = 'PROCESSED',
            confirmed_at = now(), lease_token = NULL, locked_at = NULL
        WHERE id = 'legacy-paid' AND status = 'processing'
          AND lease_token = $1
        RETURNING id
      `;
      const staleCompletion = await db.query(complete, ["lease-b"]);
      const ownedCompletion = await db.query(complete, ["lease-a"]);
      assert.deepEqual(staleCompletion.rows, []);
      assert.deepEqual(ownedCompletion.rows, [{ id: "legacy-paid" }]);

      const terminal = await db.query(`
        SELECT status, provider_status, provider_upload_id,
               confirmed_at IS NOT NULL AS is_confirmed, lease_token, locked_at
        FROM analytics_outbox_events WHERE id = 'legacy-paid'
      `);
      assert.deepEqual(terminal.rows, [{
        status: "confirmed",
        provider_status: "PROCESSED",
        provider_upload_id: "123456",
        is_confirmed: true,
        lease_token: null,
        locked_at: null,
      }]);

      const due = await db.query(`
        SELECT id FROM analytics_outbox_events
        WHERE status IN ('pending', 'sent') AND next_attempt_at <= now()
      `);
      assert.deepEqual(due.rows, []);
    } finally {
      await db.close();
    }
  });
});

async function createLegacyDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE auth_accounts (provider_user_id VARCHAR(191) NOT NULL);
      CREATE TABLE orders (
        id VARCHAR(32) PRIMARY KEY,
        user_id TEXT NOT NULL,
        customer_phone VARCHAR(80) NOT NULL
      );
    `);
    for (const migration of [
      "20260905120000_add_guest_checkout_activation_outbox",
      "20260907143000_add_analytics_provider_upload_id",
    ]) {
      await db.exec(await readFile(
        resolve(migrationsDirectory, migration, "migration.sql"),
        "utf8",
      ));
    }
    await db.exec(`
      INSERT INTO orders (id, customer_phone)
      VALUES ('AM-HISTORICAL', 'test-phone');
      INSERT INTO analytics_outbox_events
        (id, event_type, aggregate_id, payload, status, sent_at,
         provider_upload_id, provider_response, next_attempt_at)
      VALUES ('legacy-paid', 'order_paid', 'AM-HISTORICAL', '{}', 'sent',
              '2026-09-08 13:04:30.123', '123456', 'accepted',
              '2026-09-08 13:04:30.123');
    `);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

async function applyConfirmationMigration(db: PGlite) {
  const migration = await readFile(
    resolve(migrationsDirectory, confirmationMigration, "migration.sql"),
    "utf8",
  );
  // A PostgreSQL enum value must be usable after the migration commits, not
  // within the transaction that added it.
  await db.transaction(async (tx) => {
    await tx.exec(migration);
  });
}
