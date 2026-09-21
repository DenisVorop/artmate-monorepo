import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

describe("payment recovery migration", () => {
  it("replaces the Ozon queue and backfills only begun unresolved real-provider orders", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE orders(id VARCHAR(32) PRIMARY KEY,payment_method TEXT NOT NULL DEFAULT 'tbank_acquiring',payment_status TEXT NOT NULL DEFAULT 'pending',paid_at TIMESTAMP,
          payment_redirect_url TEXT NOT NULL DEFAULT '/checkout/success',ozon_acquiring_order_id TEXT,ozon_acquiring_payment_id TEXT,tbank_acquiring_order_id TEXT,tbank_acquiring_payment_id TEXT);
        CREATE TABLE order_ozon_payment_rechecks(order_id VARCHAR(32) PRIMARY KEY);
        INSERT INTO orders(id,payment_redirect_url) VALUES ('untouched','/checkout/success'),('started','/checkout/payment-initializing?startedAt=1'),('external','https://provider.test/pay');
        INSERT INTO orders(id,payment_method,payment_status,tbank_acquiring_payment_id) VALUES
          ('paid','tbank_acquiring','paid','1'),('closed','tbank_acquiring','closed_unpaid','2'),('mock','bank_card_mock','pending','3'),('identified','tbank_acquiring','failed','4');
        INSERT INTO orders(id,payment_method,payment_status) VALUES ('old-ozon','ozon_acquiring','failed');
        INSERT INTO order_ozon_payment_rechecks VALUES ('old-ozon');
      `);
      await db.exec(
        await readFile(
          resolve(
            __dirname,
            "../prisma/migrations/20260920170000_order_payment_recovery/migration.sql",
          ),
          "utf8",
        ),
      );
      const jobs = await db.query<{
        order_id: string;
        status: string;
        attempts: number;
      }>(
        "SELECT order_id,status::text,attempts FROM order_payment_recoveries ORDER BY order_id",
      );
      assert.deepEqual(
        jobs.rows,
        ["external", "identified", "old-ozon", "started"].map((order_id) => ({
          order_id,
          status: "pending",
          attempts: 0,
        })),
      );
      const old = await db.query<{ name: unknown }>(
        "SELECT to_regclass('order_ozon_payment_rechecks') AS name",
      );
      assert.equal(old.rows[0]?.name, null);
      await assert.rejects(
        db.exec(
          "UPDATE order_payment_recoveries SET status='checking' WHERE order_id='started'",
        ),
        /lease_shape/,
      );
      await assert.rejects(
        db.exec(
          "UPDATE order_payment_recoveries SET status='resolved' WHERE order_id='started'",
        ),
        /finished_shape/,
      );
      await assert.rejects(
        db.exec(
          "UPDATE order_payment_recoveries SET last_error='provider response SECRET' WHERE order_id='started'",
        ),
        /reason_check/,
      );
      await db.exec(
        "UPDATE order_payment_recoveries SET status='attention',last_error='closure_unconfirmed' WHERE order_id='old-ozon'",
      );
    } finally {
      await db.close();
    }
  });
});
