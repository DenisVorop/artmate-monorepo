import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260917120000_affiliate_payouts/migration.sql",
);

describe("affiliate payouts migration", () => {
  it("enforces one pending request, immutable journal and partner references", async () => {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "affiliate_partners" ("id" VARCHAR(32) PRIMARY KEY, "user_id" TEXT NOT NULL);
      INSERT INTO "users" ("id") VALUES ('partner-user'), ('admin-1');
      INSERT INTO "affiliate_partners" ("id", "user_id") VALUES ('partner-1', 'partner-user');
    `);
    await db.exec(await readFile(migrationPath, "utf8"));
    await db.exec(`
      INSERT INTO "affiliate_payouts" (
        "id", "partner_id", "status", "amount_kopecks", "minimum_payout_kopecks",
        "contract_version", "contract_number", "contract_signed_at", "contract_payment_details"
      ) VALUES (
        'payout-1', 'partner-1', 'pending', 500000, 500000,
        2, 'A-2', '2026-09-01T00:00:00Z', 'snapshot'
      );
      INSERT INTO "affiliate_payout_journal_entries" (
        "id", "payout_id", "partner_id", "kind", "amount_kopecks"
      ) VALUES ('journal-1', 'payout-1', 'partner-1', 'reserve', 500000);
      INSERT INTO "affiliate_payout_events" (
        "id", "payout_id", "partner_id", "status", "actor_user_id"
      ) VALUES ('event-1', 'payout-1', 'partner-1', 'pending', 'partner-user');
    `);

    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payouts" (
          "id", "partner_id", "status", "amount_kopecks", "minimum_payout_kopecks",
          "contract_version", "contract_number", "contract_signed_at", "contract_payment_details"
        ) VALUES (
          'payout-2', 'partner-1', 'pending', 500000, 500000,
          2, 'A-2', '2026-09-01T00:00:00Z', 'snapshot'
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`UPDATE "affiliate_payout_journal_entries" SET "amount_kopecks" = 1 WHERE "id" = 'journal-1'`),
    );
    await assert.rejects(() =>
      db.exec(`UPDATE "affiliate_payouts" SET "amount_kopecks" = 600000 WHERE "id" = 'payout-1'`),
    );
    await assert.rejects(() =>
      db.exec(`DELETE FROM "affiliate_payout_journal_entries" WHERE "id" = 'journal-1'`),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payout_events" (
          "id", "payout_id", "partner_id", "status", "actor_user_id"
        ) VALUES ('event-duplicate', 'payout-1', 'partner-1', 'pending', 'partner-user')
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payout_journal_entries" (
          "id", "payout_id", "partner_id", "kind", "amount_kopecks"
        ) VALUES ('journal-wrong-amount', 'payout-1', 'partner-1', 'pay', 1)
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payouts" (
          "id", "partner_id", "status", "amount_kopecks", "minimum_payout_kopecks",
          "contract_version", "contract_number", "contract_signed_at", "contract_payment_details", "reason"
        ) VALUES (
          'payout-null-reason', 'partner-1', 'rejected', 500000, 500000,
          2, 'A-2', '2026-09-01T00:00:00Z', 'snapshot', NULL
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payouts" (
          "id", "partner_id", "status", "amount_kopecks", "minimum_payout_kopecks",
          "contract_version", "contract_number", "contract_signed_at", "contract_payment_details", "paid_at", "reference"
        ) VALUES (
          'payout-null-reference', 'partner-1', 'paid', 500000, 500000,
          2, 'A-2', '2026-09-01T00:00:00Z', 'snapshot', '2026-09-17T00:00:00Z', NULL
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payouts" (
          "id", "partner_id", "status", "amount_kopecks", "minimum_payout_kopecks",
          "contract_version", "contract_number", "contract_signed_at", "contract_payment_details"
        ) VALUES (
          'payout-below-snapshot', 'partner-1', 'pending', 499999, 500000,
          2, 'A-2', '2026-09-01T00:00:00Z', 'snapshot'
        )
      `),
    );
    await assert.rejects(() =>
      db.exec(`
        INSERT INTO "affiliate_payout_journal_entries" (
          "id", "payout_id", "partner_id", "kind", "amount_kopecks"
        ) VALUES ('journal-wrong', 'payout-1', 'missing', 'pay', 500000)
      `),
    );
    await db.close();
  });
});
