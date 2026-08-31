import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const baseMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260509190000_add_feature_banners/migration.sql",
);
const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260831140000_feature_banner_audiences/migration.sql",
);

async function createBaseDatabase() {
  const db = new PGlite();
  await db.exec(await readFile(baseMigrationPath, "utf8"));
  return db;
}

describe("feature banner audiences migration", () => {
  it("backfills every scalar audience and seeds welcome-bonus without changing old rows", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(`
        INSERT INTO "feature_banners" (
          "id", "slug", "title", "description", "audience", "enabled"
        ) VALUES (
          'existing-banner', 'existing', 'Existing', 'Keep me', 'anonymous', false
        )
      `);
      await db.exec(await readFile(migrationPath, "utf8"));

      const rows = await db.query<{
        audiences: string[];
        description: string;
        enabled: boolean;
        slug: string;
        title: string;
        ctaHref: string | null;
      }>(`
        SELECT "audiences"::text[] AS "audiences", "description", "enabled",
               "slug", "title", "cta_href" AS "ctaHref"
        FROM "feature_banners"
        ORDER BY "slug"
      `);
      assert.deepEqual(rows.rows, [
        {
          audiences: ["anonymous"],
          description: "Keep me",
          enabled: false,
          slug: "existing",
          title: "Existing",
          ctaHref: null,
        },
        {
          audiences: ["telegram_unlinked"],
          description: "Будем присылать обновления по заказам в удобный чат.",
          enabled: true,
          slug: "telegram-link",
          title: "Подключите Telegram",
          ctaHref: "/account",
        },
        {
          audiences: ["anonymous", "telegram_unlinked"],
          description: "Получите бонус после авторизации и привязки Telegram.",
          enabled: true,
          slug: "welcome-bonus",
          title: "Приветственный бонус",
          ctaHref: "/account",
        },
      ]);

      const scalar = await db.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feature_banners' AND column_name = 'audience'
      `);
      assert.equal(scalar.rows.length, 0);
    } finally {
      await db.close();
    }
  });

  it("rejects NULL, empty arrays and arrays containing NULL", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      for (const audiences of [
        "NULL",
        "ARRAY[]::feature_banner_audience[]",
        "ARRAY['anonymous'::feature_banner_audience, NULL]",
      ]) {
        await assert.rejects(
          db.exec(`
            INSERT INTO "feature_banners" (
              "id", "slug", "title", "description", "audiences"
            ) VALUES (
              'invalid-${Math.random()}', 'invalid-${Math.random()}',
              'Invalid', 'Invalid', ${audiences}
            )
          `),
        );
      }
    } finally {
      await db.close();
    }
  });

  it("fails clearly and rolls back when welcome-bonus already exists", async () => {
    const db = await createBaseDatabase();
    try {
      await db.exec(`
        INSERT INTO "feature_banners" (
          "id", "slug", "title", "description", "audience"
        ) VALUES ('collision', 'welcome-bonus', 'Existing', 'Do not overwrite', 'all')
      `);
      await assert.rejects(
        db.exec(await readFile(migrationPath, "utf8")),
        /welcome-bonus.*already exists/i,
      );
      await db.exec("ROLLBACK");

      const row = await db.query<{ description: string }>(`
        SELECT "description" FROM "feature_banners" WHERE "slug" = 'welcome-bonus'
      `);
      assert.deepEqual(row.rows, [{ description: "Do not overwrite" }]);
      const audiences = await db.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feature_banners' AND column_name = 'audiences'
      `);
      assert.equal(audiences.rows.length, 0);
    } finally {
      await db.close();
    }
  });
});
