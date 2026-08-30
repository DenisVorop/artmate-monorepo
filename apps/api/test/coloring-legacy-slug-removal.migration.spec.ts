import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260830180000_drop_coloring_legacy_slug/migration.sql",
);

describe("Coloring legacy slug removal migration", () => {
  it("drops the obsolete slug column and its unique index", async () => {
    const db = new PGlite();

    try {
      await db.exec(`
        CREATE TABLE "colorings" (
          "id" VARCHAR(32) PRIMARY KEY,
          "slug" VARCHAR(180)
        );
        CREATE UNIQUE INDEX "colorings_slug_key" ON "colorings"("slug");
      `);
      await db.exec(await readFile(migrationPath, "utf8"));

      const columns = await db.query<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'colorings'
        ORDER BY ordinal_position
      `);
      const indexes = await db.query<{ indexname: string }>(`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND tablename = 'colorings'
      `);

      assert.deepEqual(columns.rows, [{ column_name: "id" }]);
      assert.deepEqual(indexes.rows, [{ indexname: "colorings_pkey" }]);
    } finally {
      await db.close();
    }
  });
});
