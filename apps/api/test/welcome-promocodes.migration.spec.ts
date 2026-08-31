import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const baseMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260831120000_add_promocodes/migration.sql",
);
const welcomeMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260831130000_add_welcome_promocode/migration.sql",
);

async function createBaseDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "orders" (
      "id" VARCHAR(32) PRIMARY KEY,
      "subtotal" DECIMAL(12,2) NOT NULL
    );
  `);
  await db.exec(await readFile(baseMigrationPath, "utf8"));
  return db;
}

describe("welcome promocode migration", () => {
  it("adds STANDARD by default and seeds ARTMSTART without changing existing promos", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(`
        INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points")
        VALUES ('standard-1', 'SALE10', 'Sale', 'percentage', 1000)
      `);
      await db.exec(await readFile(welcomeMigrationPath, "utf8"));

      const promos = await db.query<{
        basisPoints: number;
        code: string;
        kind: string;
        maxUsesPerUser: number | null;
        name: string;
      }>(`
        SELECT
          "basis_points" AS "basisPoints",
          "code",
          "kind"::text AS "kind",
          "max_uses_per_user" AS "maxUsesPerUser",
          "name"
        FROM "promo_codes"
        ORDER BY "code"
      `);
      assert.deepEqual(promos.rows, [
        {
          basisPoints: 2000,
          code: "ARTMSTART",
          kind: "welcome",
          maxUsesPerUser: 1,
          name: "Приветственный промокод",
        },
        {
          basisPoints: 1000,
          code: "SALE10",
          kind: "standard",
          maxUsesPerUser: null,
          name: "Sale",
        },
      ]);
    } finally {
      await db.close();
    }
  });

  it("fails clearly instead of overwriting an existing ARTMSTART code", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(`
        INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points")
        VALUES ('collision', 'ARTMSTART', 'Existing', 'percentage', 1000)
      `);
      await assert.rejects(
        db.exec(await readFile(welcomeMigrationPath, "utf8")),
        /ARTMSTART.*already exists/i,
      );
      await db.exec("ROLLBACK");

      const existing = await db.query<{
        basisPoints: number;
        name: string;
      }>(`
        SELECT "basis_points" AS "basisPoints", "name"
        FROM "promo_codes"
        WHERE "code" = 'ARTMSTART'
      `);
      assert.deepEqual(existing.rows, [{ basisPoints: 1000, name: "Existing" }]);

      const kindColumns = await db.query(`
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'promo_codes' AND column_name = 'kind'
      `);
      assert.equal(kindColumns.rows.length, 0);

      const kindTypes = await db.query(`
        SELECT 1 FROM pg_type WHERE typname = 'promo_code_kind'
      `);
      assert.equal(kindTypes.rows.length, 0);
    } finally {
      await db.close();
    }
  });

  it("enforces one WELCOME campaign and maxUsesPerUser=1", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(await readFile(welcomeMigrationPath, "utf8"));
      await assert.rejects(
        db.exec(`
          INSERT INTO "promo_codes" (
            "id", "code", "kind", "name", "type", "basis_points", "max_uses_per_user"
          ) VALUES (
            'welcome-2', 'WELCOME2', 'welcome', 'Other welcome', 'percentage', 1000, 1
          )
        `),
      );
      await assert.rejects(
        db.exec(`
          UPDATE "promo_codes"
          SET "max_uses_per_user" = 2
          WHERE "code" = 'ARTMSTART'
        `),
      );
      await assert.rejects(
        db.exec(`
          UPDATE "promo_codes"
          SET "max_uses_per_user" = NULL
          WHERE "code" = 'ARTMSTART'
        `),
      );

      await db.exec(`
        INSERT INTO "promo_codes" ("id", "code", "name", "type", "basis_points")
        VALUES ('standard-2', 'STANDARD2', 'Standard', 'percentage', 1000)
      `);
      const standard = await db.query<{ maxUsesPerUser: number | null }>(`
        SELECT "max_uses_per_user" AS "maxUsesPerUser"
        FROM "promo_codes"
        WHERE "code" = 'STANDARD2'
      `);
      assert.deepEqual(standard.rows, [{ maxUsesPerUser: null }]);
    } finally {
      await db.close();
    }
  });
});
