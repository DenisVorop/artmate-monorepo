import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260920150000_payment_settlement_events/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TYPE order_payment_status AS ENUM ('pending', 'paid', 'failed');
    CREATE TABLE orders (
      id VARCHAR(32) PRIMARY KEY,
      payment_status order_payment_status NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMP(3),
      terminal_payment_failed_at TIMESTAMP(3)
    );
    INSERT INTO orders VALUES
      ('paid', 'paid', '2026-09-20 10:00:00', NULL),
      ('invalid-paid-no-time', 'paid', NULL, NULL),
      ('failed', 'failed', NULL, '2026-09-20 11:00:00'),
      ('pending', 'pending', NULL, NULL);
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

describe("payment settlement events migration", () => {
  it("backfills only recorded paid facts and never infers final closure from failures", async () => {
    const db = await createDatabase();
    try {
      const events = await db.query<{
        id: string;
        order_id: string;
        kind: string;
      }>("SELECT id, order_id, kind::text FROM order_payment_events");
      assert.deepEqual(events.rows, [
        { id: "backfill-paid-paid", order_id: "paid", kind: "paid" },
      ]);
      const due = await db.query<{
        id: string;
      }>(`SELECT event.id FROM order_payment_events event
        LEFT JOIN loyalty_payment_receipts receipt ON receipt.event_id = event.id
        WHERE receipt.event_id IS NULL OR (receipt.processed_at IS NULL AND receipt.next_attempt_at <= CURRENT_TIMESTAMP)`);
      assert.deepEqual(due.rows, [{ id: "backfill-paid-paid" }]);
      const failed = await db.query<{ state: string; closed: unknown }>(
        "SELECT payment_status::text AS state, payment_closed_unpaid_at AS closed FROM orders WHERE id='failed'",
      );
      assert.deepEqual(failed.rows, [{ state: "failed", closed: null }]);
    } finally {
      await db.close();
    }
  });

  it("requires exact source state and timestamp for each published event", async () => {
    const db = await createDatabase();
    try {
      await assert.rejects(
        db.exec(
          "UPDATE orders SET payment_status='closed_unpaid' WHERE id='failed'",
        ),
        /orders_closed_unpaid_state_check/,
      );
      await db.exec(
        "UPDATE orders SET payment_status='closed_unpaid', payment_closed_unpaid_at='2026-09-20 12:00:00' WHERE id='failed'",
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO order_payment_events VALUES ('wrong-time','failed','closed_unpaid','2026-09-20 12:00:01',now())",
        ),
        /does not match closed unpaid source fact/,
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO order_payment_events VALUES ('wrong-kind','pending','paid','2026-09-20 12:00:00',now())",
        ),
        /does not match paid source fact/,
      );
      await db.exec(
        "INSERT INTO order_payment_events VALUES ('closed','failed','closed_unpaid','2026-09-20 12:00:00',now())",
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO order_payment_events VALUES ('duplicate','failed','closed_unpaid','2026-09-20 12:00:00',now())",
        ),
        /order_payment_events_order_id_kind_key/,
      );
      await assert.rejects(
        db.exec("UPDATE orders SET paid_at=now() WHERE id='failed'"),
        /orders_closed_unpaid_state_check/,
      );
    } finally {
      await db.close();
    }
  });

  it("preserves immutable events while receipts independently retry and acknowledge", async () => {
    const db = await createDatabase();
    try {
      await assert.rejects(
        db.exec(
          "UPDATE order_payment_events SET occurred_at=now() WHERE id='backfill-paid-paid'",
        ),
        /Order payment events are immutable/,
      );
      await assert.rejects(
        db.exec(
          "DELETE FROM order_payment_events WHERE id='backfill-paid-paid'",
        ),
        /Order payment events are immutable/,
      );
      await db.exec(
        "UPDATE order_payment_events SET id=id WHERE id='backfill-paid-paid'",
      );
      await db.exec(
        "INSERT INTO loyalty_payment_receipts(event_id,attempts,next_attempt_at,last_error) VALUES ('backfill-paid-paid',1,now()+interval '1 hour','settlement_failed')",
      );
      const due = await db.query<{
        count: number;
      }>(`SELECT count(*)::int AS count FROM order_payment_events event
        LEFT JOIN loyalty_payment_receipts receipt ON receipt.event_id=event.id
        WHERE receipt.event_id IS NULL OR (receipt.processed_at IS NULL AND receipt.next_attempt_at<=CURRENT_TIMESTAMP)`);
      assert.equal(due.rows[0]?.count, 0);
      await db.exec(
        "UPDATE loyalty_payment_receipts SET processed_at=now(),attempts=2,last_error=NULL WHERE event_id='backfill-paid-paid'",
      );
      await assert.rejects(
        db.exec(
          "UPDATE loyalty_payment_receipts SET attempts=-1 WHERE event_id='backfill-paid-paid'",
        ),
        /check constraint/,
      );
      const eventCount = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM order_payment_events",
      );
      assert.equal(eventCount.rows[0]?.count, 1);
    } finally {
      await db.close();
    }
  });
});
