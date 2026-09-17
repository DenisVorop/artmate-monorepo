import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260916210000_affiliate_financial_accounting/migration.sql",
);

describe("affiliate financial accounting migration", () => {
  it("enforces unique operations, nonnegative amounts and append-only audit rows", async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TYPE "order_payment_status" AS ENUM ('pending', 'paid', 'failed');
      CREATE TYPE "order_crm_status" AS ENUM ('new', 'in_progress', 'waiting_payment', 'paid', 'delivering', 'completed', 'cancelled');
      CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "name" TEXT);
      CREATE TABLE "affiliate_partners" ("id" VARCHAR(32) PRIMARY KEY, "user_id" TEXT NOT NULL);
      CREATE TABLE "orders" (
        "id" VARCHAR(32) PRIMARY KEY,
        "payment_status" "order_payment_status" NOT NULL DEFAULT 'pending',
        "crm_status" "order_crm_status" NOT NULL DEFAULT 'new'
      );
      INSERT INTO "users" ("id", "name") VALUES ('admin-1', 'Admin');
      INSERT INTO "affiliate_partners" ("id", "user_id") VALUES
        ('partner-1', 'partner-user'), ('partner-2', 'other-partner-user');
      INSERT INTO "orders" ("id") VALUES ('order-1'), ('order-2');
    `);
    await db.exec(await readFile(migrationPath, "utf8"));

    await db.exec(`
      INSERT INTO "affiliate_commissions" (
        "id", "order_id", "partner_id", "code_snapshot", "partner_percent",
        "buyer_percent", "is_self_purchase", "subtotal_kopecks",
        "earned_kopecks", "item_snapshot"
      ) VALUES (
        'commission-1', 'order-1', 'partner-1', 'ARTM-ONE', 10, 10, false,
        1000, 100, '[]'::jsonb
      );
      INSERT INTO "affiliate_ledger_entries" (
        "id", "commission_id", "order_id", "partner_id", "kind",
        "amount_kopecks", "operation_key"
      ) VALUES (
        'entry-1', 'commission-1', 'order-1', 'partner-1', 'credit', 100,
        'order:order-1:affiliate-credit'
      );
      INSERT INTO "order_refunds" (
        "id", "order_id", "author_id", "request_id", "request_fingerprint",
        "reference", "reason", "delivery_kopecks", "total_kopecks"
      ) VALUES (
        'refund-1', 'order-1', 'admin-1', '00000000-0000-4000-8000-000000000001',
        repeat('a', 64), 'bank-ref-1', 'Confirmed refund', 0, 50
      );
    `);

    await assert.rejects(() =>
      db.exec(
        `UPDATE "order_refunds" SET "reason" = 'changed' WHERE "id" = 'refund-1'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`DELETE FROM "affiliate_ledger_entries" WHERE "id" = 'entry-1'`),
    );
    await assert.rejects(() =>
      db.exec(
        `UPDATE "affiliate_commissions" SET "earned_kopecks" = 99 WHERE "id" = 'commission-1'`,
      ),
    );
    await db.exec(
      `UPDATE "affiliate_commissions" SET "available_at" = '2026-09-30T00:00:00Z' WHERE "id" = 'commission-1'`,
    );
    await assert.rejects(() =>
      db.exec(
        `UPDATE "affiliate_commissions" SET "available_at" = '2026-10-01T00:00:00Z' WHERE "id" = 'commission-1'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `DELETE FROM "affiliate_commissions" WHERE "id" = 'commission-1'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "order_refunds" (
          "id", "order_id", "author_id", "request_id", "request_fingerprint",
          "reference", "reason", "delivery_kopecks", "total_kopecks"
        ) VALUES (
          'refund-2', 'order-1', 'admin-1', '00000000-0000-4000-8000-000000000001',
          repeat('b', 64), 'bank-ref-2', 'Duplicate request', 0, 1
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_ledger_entries" (
          "id", "commission_id", "order_id", "partner_id", "kind",
          "amount_kopecks", "operation_key"
        ) VALUES (
          'entry-second-credit', 'commission-1', 'order-1', 'partner-1', 'credit',
          100, 'second-credit-operation'
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_ledger_entries" (
          "id", "commission_id", "order_id", "partner_id", "kind",
          "amount_kopecks", "operation_key"
        ) VALUES (
          'entry-wrong-owner', 'commission-1', 'order-2', 'partner-2', 'credit',
          100, 'wrong-owner-operation'
        )
      `),
    );
    await db.exec(`
      INSERT INTO "order_refunds" (
        "id", "order_id", "author_id", "request_id", "request_fingerprint",
        "reference", "reason", "delivery_kopecks", "total_kopecks"
      ) VALUES (
        'refund-other-order', 'order-2', 'admin-1', '00000000-0000-4000-8000-000000000002',
        repeat('b', 64), 'bank-ref-other', 'Other order refund', 0, 50
      )
    `);
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_ledger_entries" (
          "id", "commission_id", "order_id", "partner_id", "refund_id", "kind",
          "amount_kopecks", "operation_key"
        ) VALUES (
          'entry-wrong-refund', 'commission-1', 'order-1', 'partner-1',
          'refund-other-order', 'reversal', -10, 'wrong-refund-operation'
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_ledger_entries" (
          "id", "commission_id", "order_id", "partner_id", "kind",
          "amount_kopecks", "operation_key"
        ) VALUES (
          'entry-2', 'commission-1', 'order-1', 'partner-1', 'reversal', 1,
          'positive-reversal'
        )
      `),
    );

    const result = await db.query<{ completed_at: Date | null }>(
      `SELECT "completed_at" FROM "orders" WHERE "id" = 'order-1'`,
    );
    assert.equal(result.rows[0]?.completed_at, null);
    await db.close();
  });
});
