import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260831120000_add_promocodes/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "orders" (
      "id" VARCHAR(32) PRIMARY KEY,
      "subtotal" DECIMAL(12,2) NOT NULL
    );
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

async function insertPromo(db: PGlite, values = "") {
  await db.exec(`
    INSERT INTO "promo_codes"
      ("id", "code", "name", "type", "basis_points"${values ? ", " + values.split("=")[0] : ""})
    VALUES
      ('promo-1', 'SALE10', 'Sale', 'percentage', 1000${values ? ", " + values.split("=")[1] : ""})
  `);
}

describe("promocodes migration", () => {
  it("is additive for old orders and enforces promo configuration constraints", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
        CREATE TABLE "orders" (
          "id" VARCHAR(32) PRIMARY KEY,
          "subtotal" DECIMAL(12,2) NOT NULL
        );
        INSERT INTO "orders" ("id", "subtotal") VALUES ('old-order', 100.00);
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      const oldOrder = await db.query<{
        discount: string;
        promoCode: string | null;
      }>(`
        SELECT "discount"::text AS "discount", "promo_code" AS "promoCode" FROM "orders"
      `);
      assert.deepEqual(oldOrder.rows, [{ discount: "0.00", promoCode: null }]);

      await insertPromo(db);
      for (const statement of [
        `INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points") VALUES ('bad-code', 'скидка', 'Bad', 'percentage', 100)`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points") VALUES ('bad-bps', 'BADBPS', 'Bad', 'percentage', 10001)`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type") VALUES ('missing-bps', 'NOBPS', 'Bad', 'percentage')`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type") VALUES ('missing-fixed', 'NOFIX', 'Bad', 'fixed')`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type", "amount_kopecks") VALUES ('bad-fixed', 'FIXED', 'Bad', 'fixed', 0)`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points", "max_discount_kopecks") VALUES ('bad-cap', 'BADCAP', 'Bad', 'percentage', 100, 0)`,
        `INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points", "starts_at", "ends_at") VALUES ('bad-dates', 'DATES', 'Bad', 'percentage', 100, '2026-09-01', '2026-09-01')`,
        `UPDATE "promo_codes" SET "reserved_count" = -1 WHERE "id" = 'promo-1'`,
      ]) {
        await assert.rejects(db.exec(statement));
      }
    } finally {
      await db.close();
    }
  });

  it("rolls back order and reservation together", async () => {
    const db = await createDatabase();
    try {
      await db.exec(`INSERT INTO "users" ("id") VALUES ('user-1')`);
      await insertPromo(db);
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.exec(
            `INSERT INTO "orders" ("id", "subtotal") VALUES ('order-1', 100.00)`,
          );
          await tx.exec(`
            INSERT INTO "promo_redemptions" (
              "id", "promo_code_id", "order_id", "user_id", "code_snapshot",
              "terms_snapshot", "pricing_snapshot", "subtotal_kopecks_snapshot",
              "discount_kopecks_snapshot", "total_kopecks_snapshot"
            ) VALUES (
              'redemption-1', 'promo-1', 'order-1', 'user-1', 'SALE10', '{}', '{}', 10000, 1000, 9000
            )
          `);
          await tx.exec(
            `UPDATE "promo_codes" SET "reserved_count" = 1 WHERE "id" = 'promo-1'`,
          );
          throw new Error("order insert integration failed");
        }),
        /integration failed/,
      );
      const counts = await db.query<{
        orders: number;
        redemptions: number;
        reserved: number;
      }>(`
        SELECT
          (SELECT count(*)::int FROM "orders") AS "orders",
          (SELECT count(*)::int FROM "promo_redemptions") AS "redemptions",
          (SELECT "reserved_count" FROM "promo_codes" WHERE "id" = 'promo-1') AS "reserved"
      `);
      assert.deepEqual(counts.rows, [
        { orders: 0, redemptions: 0, reserved: 0 },
      ]);
    } finally {
      await db.close();
    }
  });

  it("keeps snapshots immutable while allowing status transitions", async () => {
    const db = await createDatabase();
    try {
      await insertPromo(db);
      await db.exec(
        `INSERT INTO "orders" ("id", "subtotal", "discount", "promo_code", "promo_terms_snapshot", "promo_pricing_snapshot") VALUES ('order-1', 100.00, 10.00, 'SALE10', '{}', '{}')`,
      );
      await db.exec(`
        INSERT INTO "promo_redemptions" (
          "id", "promo_code_id", "order_id", "code_snapshot", "terms_snapshot",
          "pricing_snapshot", "subtotal_kopecks_snapshot", "discount_kopecks_snapshot",
          "total_kopecks_snapshot"
        ) VALUES ('redemption-1', 'promo-1', 'order-1', 'SALE10', '{}', '{}', 10000, 1000, 9000)
      `);
      await db.exec(
        `UPDATE "promo_redemptions" SET "status" = 'used', "used_at" = now() WHERE "id" = 'redemption-1'`,
      );
      await assert.rejects(
        db.exec(
          `UPDATE "promo_redemptions" SET "discount_kopecks_snapshot" = 999 WHERE "id" = 'redemption-1'`,
        ),
        /immutable/,
      );
      await assert.rejects(
        db.exec(`UPDATE "orders" SET "discount" = 9.99 WHERE "id" = 'order-1'`),
        /immutable/,
      );
      await assert.rejects(
        db.exec(
          `UPDATE "promo_redemptions" SET "status" = 'released', "released_at" = now() WHERE "id" = 'redemption-1'`,
        ),
      );
      await db.exec(
        `INSERT INTO "orders" ("id", "subtotal", "discount", "promo_code", "promo_terms_snapshot", "promo_pricing_snapshot") VALUES ('order-2', 100.00, 10.00, 'SALE10', '{}', '{}')`,
      );
      await db.exec(`
        INSERT INTO "promo_redemptions" (
          "id", "promo_code_id", "order_id", "code_snapshot", "terms_snapshot",
          "pricing_snapshot", "subtotal_kopecks_snapshot", "discount_kopecks_snapshot",
          "total_kopecks_snapshot", "status", "released_at"
        ) VALUES ('redemption-2', 'promo-1', 'order-2', 'SALE10', '{}', '{}', 10000, 1000, 9000, 'released', now())
      `);
      await db.exec(
        `UPDATE "promo_redemptions" SET "status" = 'used', "used_at" = now(), "released_at" = NULL WHERE "id" = 'redemption-2'`,
      );
    } finally {
      await db.close();
    }
  });

  it("allows truthful exceptional used counters above configured max", async () => {
    const db = await createDatabase();
    try {
      await insertPromo(db, '"max_uses"=1');
      await db.exec(
        `UPDATE "promo_codes" SET "used_count" = 2 WHERE "id" = 'promo-1'`,
      );
      const result = await db.query<{ used: number }>(
        `SELECT "used_count" AS "used" FROM "promo_codes" WHERE "id" = 'promo-1'`,
      );
      assert.equal(result.rows[0]?.used, 2);
    } finally {
      await db.close();
    }
  });
});
