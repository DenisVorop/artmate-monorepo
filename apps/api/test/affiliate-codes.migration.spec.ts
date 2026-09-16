import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20260831120000_add_promocodes",
  "20260831130000_add_welcome_promocode",
  "20260916170000_add_affiliate_partners",
  "20260916200000_add_affiliate_codes",
].map((name) =>
  resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TYPE "user_role" AS ENUM ('customer', 'admin');
    CREATE TABLE "users" (
      "id" TEXT PRIMARY KEY,
      "roles" "user_role"[] NOT NULL DEFAULT ARRAY['customer']::"user_role"[]
    );
    CREATE TABLE "orders" (
      "id" VARCHAR(32) PRIMARY KEY,
      "subtotal" DECIMAL(12,2) NOT NULL
    );
    CREATE TABLE "partner_applications" ("id" VARCHAR(32) PRIMARY KEY);
    INSERT INTO "users" ("id") VALUES ('partner-user-1'), ('partner-user-2'), ('admin-user-1');
  `);
  for (const migration of migrations) {
    await db.exec(await readFile(migration, "utf8"));
  }
  await db.exec(`
    INSERT INTO "affiliate_partners" (
      "id", "user_id", "status", "contract_number", "contract_signed_at",
      "contract_payment_details", "contract_version"
    ) VALUES
      ('partner-1', 'partner-user-1', 'active', 'A-1', '2026-09-01', 'Details', 1),
      ('partner-2', 'partner-user-2', 'active', 'A-2', '2026-09-01', 'Details', 1);
  `);
  return db;
}

describe("affiliate codes migration", () => {
  it("enforces ownership, integer rate bounds and the 20 percent budget", async () => {
    const db = await createDatabase();
    try {
      await db.exec(`
        INSERT INTO "promo_codes" (
          "id", "code", "kind", "name", "type", "basis_points",
          "affiliate_partner_id", "affiliate_partner_percent", "affiliate_comment"
        ) VALUES (
          'affiliate-code-1', 'CREATOR10', 'affiliate', 'CREATOR10', 'percentage',
          1000, 'partner-1', 10, 'private'
        )
      `);
      await db.exec(`
        INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points")
        VALUES ('standard-code', 'STANDARD', 'Standard', 'percentage', 1000)
      `);

      for (const statement of [
        `UPDATE "promo_codes" SET "affiliate_partner_percent" = -1 WHERE "id" = 'affiliate-code-1'`,
        `UPDATE "promo_codes" SET "affiliate_partner_percent" = 16 WHERE "id" = 'affiliate-code-1'`,
        `UPDATE "promo_codes" SET "affiliate_partner_percent" = NULL WHERE "id" = 'affiliate-code-1'`,
        `UPDATE "promo_codes" SET "basis_points" = 999 WHERE "id" = 'affiliate-code-1'`,
        `UPDATE "promo_codes" SET "affiliate_partner_id" = NULL WHERE "id" = 'affiliate-code-1'`,
        `UPDATE "promo_codes" SET "affiliate_comment" = repeat('x', 501) WHERE "id" = 'affiliate-code-1'`,
        `INSERT INTO "promo_codes" ("id", "code", "kind", "name", "type", "basis_points") VALUES ('missing-owner', 'AFFMISS', 'affiliate', 'AFFMISS', 'percentage', 1000)`,
        `INSERT INTO "promo_codes" ("id", "code", "kind", "name", "type", "basis_points", "affiliate_partner_id", "affiliate_partner_percent") VALUES ('bad-owner', 'AFFBAD', 'affiliate', 'AFFBAD', 'percentage', 1000, 'missing', 10)`,
        `UPDATE "promo_codes" SET "affiliate_partner_id" = 'partner-1', "affiliate_partner_percent" = 10 WHERE "id" = 'standard-code'`,
      ]) {
        await assert.rejects(db.exec(statement));
      }
    } finally {
      await db.close();
    }
  });

  it("keeps global code uniqueness across standard and affiliate kinds", async () => {
    const db = await createDatabase();
    try {
      await db.exec(`
        INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points")
        VALUES ('standard-code', 'GLOBAL', 'Standard', 'percentage', 1000)
      `);
      await assert.rejects(
        db.exec(`
          INSERT INTO "promo_codes" (
            "id", "code", "kind", "name", "type", "basis_points",
            "affiliate_partner_id", "affiliate_partner_percent"
          ) VALUES (
            'affiliate-code', 'GLOBAL', 'affiliate', 'GLOBAL', 'percentage',
            1000, 'partner-1', 10
          )
        `),
      );
    } finally {
      await db.close();
    }
  });
});
