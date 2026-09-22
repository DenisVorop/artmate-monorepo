import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

it("requeues only unresolved Ozon closure checks without changing payment facts", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, payment_method TEXT, payment_status TEXT, paid_at TIMESTAMP);
      CREATE TABLE order_payment_recoveries (
        order_id TEXT PRIMARY KEY, status TEXT, attempts INTEGER, next_attempt_at TIMESTAMP,
        lease_token UUID, locked_until TIMESTAMP, finished_at TIMESTAMP, last_error TEXT, updated_at TIMESTAMP
      );
      INSERT INTO orders VALUES
        ('retry','ozon_acquiring','pending',NULL),
        ('paid','ozon_acquiring','paid',CURRENT_TIMESTAMP),
        ('paid-time','ozon_acquiring','failed',CURRENT_TIMESTAMP),
        ('closed','ozon_acquiring','closed_unpaid',NULL),
        ('tbank','tbank_acquiring','pending',NULL),
        ('mismatch','ozon_acquiring','pending',NULL),
        ('checking','ozon_acquiring','pending',NULL);
      INSERT INTO order_payment_recoveries (order_id,status,attempts,last_error)
        SELECT id,'attention',12,'closure_unconfirmed' FROM orders;
      UPDATE order_payment_recoveries SET last_error='identity_mismatch' WHERE order_id='mismatch';
      UPDATE order_payment_recoveries SET status='checking' WHERE order_id='checking';
    `);
    const before = await db.query("SELECT * FROM orders ORDER BY id");
    const migration = await readFile(
      resolve(
        __dirname,
        "../prisma/migrations/20260923001000_retry_ozon_unpaid_closures/migration.sql",
      ),
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    const jobs = await db.query<{
      order_id: string;
      status: string;
      attempts: number;
      last_error: string | null;
    }>(
      "SELECT order_id,status,attempts,last_error FROM order_payment_recoveries ORDER BY order_id",
    );
    assert.deepEqual(
      jobs.rows.filter((job) => job.status === "pending"),
      [
        {
          order_id: "retry",
          status: "pending",
          attempts: 0,
          last_error: null,
        },
      ],
    );
    assert.ok(
      jobs.rows
        .filter((job) => job.order_id !== "retry")
        .every((job) => job.attempts === 12),
    );
    assert.deepEqual(
      (await db.query("SELECT * FROM orders ORDER BY id")).rows,
      before.rows,
    );
  } finally {
    await db.close();
  }
});
