import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { AffiliatePayoutBalanceService } from "../src/affiliate/affiliate-payout-balance.service";
import { deriveAffiliatePayoutBalance } from "../src/affiliate/payout-balance";
import type { Prisma } from "../src/generated/prisma/client";

describe("affiliate payout balance", () => {
  it("reserves only the selected partial amount", () => {
    assert.deepEqual(
      deriveAffiliatePayoutBalance({
        grossAvailableKopecks: 1_000_000n,
        paidKopecks: 100_000n,
        reservedKopecks: 500_000n,
      }),
      {
        availableKopecks: 400_000,
        debtKopecks: 0,
        paidKopecks: 100_000,
        reservedKopecks: 500_000,
      },
    );
  });

  it("turns paid refunds into debt and lets later accruals cover it", () => {
    assert.deepEqual(
      deriveAffiliatePayoutBalance({
        grossAvailableKopecks: 400_000n,
        paidKopecks: 500_000n,
        reservedKopecks: 0n,
      }),
      {
        availableKopecks: 0,
        debtKopecks: 100_000,
        paidKopecks: 500_000,
        reservedKopecks: 0,
      },
    );
    assert.equal(
      deriveAffiliatePayoutBalance({
        grossAvailableKopecks: 550_000n,
        paidKopecks: 500_000n,
        reservedKopecks: 0n,
      }).availableKopecks,
      50_000,
    );
  });

  it("fails closed for invalid or unsafe aggregates", () => {
    assert.throws(() =>
      deriveAffiliatePayoutBalance({
        grossAvailableKopecks: -1n,
        paidKopecks: 0n,
        reservedKopecks: 0n,
      }),
    );
    assert.throws(() =>
      deriveAffiliatePayoutBalance({
        grossAvailableKopecks: BigInt(Number.MAX_SAFE_INTEGER) + 1n,
        paidKopecks: 0n,
        reservedKopecks: 0n,
      }),
    );
  });

  it("pre-aggregates all payout statuses without journal/event fanout", async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TYPE "order_payment_status" AS ENUM ('pending', 'paid', 'failed');
      CREATE TYPE "order_crm_status" AS ENUM ('new', 'completed', 'cancelled');
      CREATE TYPE "affiliate_ledger_entry_kind" AS ENUM ('credit', 'reversal');
      CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "affiliate_partners" ("id" VARCHAR(32) PRIMARY KEY, "user_id" TEXT NOT NULL);
      CREATE TABLE "orders" (
        "id" VARCHAR(32) PRIMARY KEY, "payment_status" "order_payment_status" NOT NULL,
        "crm_status" "order_crm_status" NOT NULL, "completed_at" TIMESTAMP(3)
      );
      CREATE TABLE "affiliate_commissions" (
        "id" VARCHAR(32) PRIMARY KEY, "order_id" VARCHAR(32) NOT NULL,
        "partner_id" VARCHAR(32) NOT NULL, "earned_kopecks" BIGINT NOT NULL,
        "available_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL
      );
      CREATE TABLE "affiliate_ledger_entries" (
        "id" VARCHAR(32) PRIMARY KEY, "commission_id" VARCHAR(32) NOT NULL,
        "partner_id" VARCHAR(32) NOT NULL, "kind" "affiliate_ledger_entry_kind" NOT NULL,
        "amount_kopecks" BIGINT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL
      );
      INSERT INTO "users" VALUES ('partner-user'), ('admin-user');
      INSERT INTO "affiliate_partners" VALUES ('partner-1', 'partner-user');
      INSERT INTO "orders" VALUES ('order-1', 'paid', 'completed', '2026-08-01');
      INSERT INTO "affiliate_commissions" VALUES ('commission-1', 'order-1', 'partner-1', 2000000, '2026-08-15', '2026-08-01');
      INSERT INTO "affiliate_ledger_entries" VALUES ('credit-1', 'commission-1', 'partner-1', 'credit', 2000000, '2026-08-01');
    `);
    await db.exec(
      await readFile(
        resolve(__dirname, "../prisma/migrations/20260917120000_affiliate_payouts/migration.sql"),
        "utf8",
      ),
    );
    for (const [id, amount] of [["paid", 300_000], ["rejected", 200_000], ["cancelled", 100_000], ["pending", 500_000]] as const) {
      await db.exec(`
        INSERT INTO "affiliate_payouts" (
          "id", "partner_id", "amount_kopecks", "minimum_payout_kopecks",
          "contract_version", "contract_number", "contract_signed_at", "contract_payment_details"
        ) VALUES ('${id}', 'partner-1', ${amount}, 100000, 1, 'A-1', '2026-08-01', 'snapshot');
        INSERT INTO "affiliate_payout_events" ("id", "payout_id", "partner_id", "status", "actor_user_id")
          VALUES ('${id}-pending', '${id}', 'partner-1', 'pending', 'partner-user');
        INSERT INTO "affiliate_payout_journal_entries" ("id", "payout_id", "partner_id", "kind", "amount_kopecks")
          VALUES ('${id}-reserve', '${id}', 'partner-1', 'reserve', ${amount});
      `);
      if (id !== "pending") {
        const terminal = id;
        const reason = terminal === "paid" ? "NULL" : "'closed'";
        const paidAt = terminal === "paid" ? "'2026-09-01'" : "NULL";
        const reference = terminal === "paid" ? "'bank-1'" : "NULL";
        const actor = terminal === "cancelled" ? "NULL" : "'admin-user'";
        const journalKind = terminal === "paid" ? "pay" : "release";
        await db.exec(`
          UPDATE "affiliate_payouts" SET "status" = '${terminal}', "reason" = ${reason},
            "paid_at" = ${paidAt}, "reference" = ${reference}, "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = '${id}';
          INSERT INTO "affiliate_payout_events" ("id", "payout_id", "partner_id", "status", "actor_user_id", "reason")
            VALUES ('${id}-terminal', '${id}', 'partner-1', '${terminal}', ${actor}, ${reason});
          INSERT INTO "affiliate_payout_journal_entries" ("id", "payout_id", "partner_id", "kind", "amount_kopecks")
            VALUES ('${id}-terminal', '${id}', 'partner-1', '${journalKind}', ${amount});
        `);
      }
    }
    const service = new AffiliatePayoutBalanceService();
    const balance = await service.calculateInTransaction(
      {
        $queryRaw: async (query: { text: string; values: unknown[] }) => {
          const result = await db.query(
            query.text,
            query.values.map((value) =>
              value instanceof Date
                ? value.toISOString().replace("T", " ").replace("Z", "")
                : value,
            ),
          );
          return result.rows;
        },
      } as unknown as Prisma.TransactionClient,
      "partner-1",
    );
    assert.deepEqual(balance, {
      availableKopecks: 1_200_000,
      reservedKopecks: 500_000,
      paidKopecks: 300_000,
      debtKopecks: 0,
      pendingKopecks: 0,
      heldKopecks: 0,
      reversedKopecks: 0,
    });
    await db.exec(`
      INSERT INTO "users" VALUES ('broken-user');
      INSERT INTO "affiliate_partners" VALUES ('broken-partner', 'broken-user');
      INSERT INTO "affiliate_payouts" (
        "id", "partner_id", "amount_kopecks", "minimum_payout_kopecks",
        "contract_version", "contract_number", "contract_signed_at", "contract_payment_details"
      ) VALUES ('broken-payout', 'broken-partner', 100000, 100000, 1, 'B-1', '2026-08-01', 'snapshot');
      INSERT INTO "affiliate_payout_events" ("id", "payout_id", "partner_id", "status", "actor_user_id")
        VALUES ('broken-event', 'broken-payout', 'broken-partner', 'pending', 'broken-user');
    `);
    await assert.rejects(
      service.calculateInTransaction(
        {
          $queryRaw: async (query: { text: string; values: unknown[] }) => {
            const result = await db.query(query.text, query.values);
            return result.rows;
          },
        } as unknown as Prisma.TransactionClient,
        "broken-partner",
      ),
      /ledger is inconsistent/,
    );
    await db.close();
  });
});
