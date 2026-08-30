import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260830210000_add_high_resolution_coloring_derivatives/migration.sql",
);

describe("High-resolution coloring derivatives migration", () => {
  it("preserves published history and permits native and bounded v3 geometry", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        INSERT INTO "coloring_revisions" (
          "id", "derivative_profile", "color_space", "width", "height"
        ) VALUES
          ('historical-v1', 'webp-preview-v1', 'srgb', 1200, 1600),
          ('historical-v2', 'webp-preview-v2', 'srgb', 1141, 1600);
      `);
      const before = await db.query(
        'SELECT * FROM "coloring_revisions" ORDER BY "id"',
      );

      await db.exec(await readFile(migrationPath, "utf8"));

      const after = await db.query(
        'SELECT * FROM "coloring_revisions" ORDER BY "id"',
      );
      assert.deepEqual(after.rows, before.rows);

      await db.exec(`
        INSERT INTO "coloring_revisions" (
          "id", "derivative_profile", "color_space", "width", "height"
        ) VALUES
          ('native-v3', 'webp-preview-v3', 'srgb', 2450, 3436),
          ('maximum-v3', 'webp-preview-v3', 'srgb', 4096, 4096);
      `);

      const added = await db.query<{
        id: string;
        width: number;
        height: number;
      }>(`
        SELECT "id", "width", "height" FROM "coloring_revisions"
        WHERE "derivative_profile" = 'webp-preview-v3' ORDER BY "id"
      `);
      assert.deepEqual(added.rows, [
        { id: "maximum-v3", width: 4096, height: 4096 },
        { id: "native-v3", width: 2450, height: 3436 },
      ]);
    } finally {
      await db.close();
    }
  });

  it("rejects unknown profiles, non-sRGB data and geometry or bytes above their caps", async () => {
    const db = await createDatabase();

    try {
      await db.exec(await readFile(migrationPath, "utf8"));

      for (const [
        profile,
        colorSpace,
        width,
        height,
        outlineBytes,
        coloredBytes,
      ] of [
        ["unsafe-profile", "srgb", 2450, 3436, 1, 1],
        ["webp-preview-v3", "display-p3", 2450, 3436, 1, 1],
        ["webp-preview-v3", "srgb", 4097, 1600, 1, 1],
        ["webp-preview-v3", "srgb", 1200, 4097, 1, 1],
        ["webp-preview-v3", "srgb", 0, 1600, 1, 1],
        ["webp-preview-v3", "srgb", 1200, -1, 1, 1],
        ["webp-preview-v3", "srgb", 2450, 3436, 20 * 1024 * 1024 + 1, 1],
        ["webp-preview-v3", "srgb", 2450, 3436, 1, 20 * 1024 * 1024 + 1],
      ] as const) {
        await assert.rejects(
          db.query(
            `
          INSERT INTO "coloring_revisions" (
            "id", "derivative_profile", "color_space", "width", "height",
            "outline_byte_size", "colored_byte_size"
          ) VALUES ('invalid', $1, $2, $3, $4, $5, $6)
        `,
            [profile, colorSpace, width, height, outlineBytes, coloredBytes],
          ),
        );
      }
    } finally {
      await db.close();
    }
  });
});

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE "coloring_revisions" (
      "id" VARCHAR(32) PRIMARY KEY,
      "derivative_profile" VARCHAR(40) NOT NULL,
      "color_space" VARCHAR(20) NOT NULL,
      "width" INTEGER NOT NULL,
      "height" INTEGER NOT NULL,
      "outline_byte_size" INTEGER NOT NULL DEFAULT 1,
      "colored_byte_size" INTEGER NOT NULL DEFAULT 1,
      CONSTRAINT "coloring_revisions_dimensions_check" CHECK (
        "width" BETWEEN 1 AND 1600 AND "height" BETWEEN 1 AND 1600
        AND "width"::BIGINT * "height"::BIGINT <= 2560000
      ),
      CONSTRAINT "coloring_revisions_profile_check" CHECK (
        "derivative_profile" IN ('webp-preview-v1', 'webp-preview-v2')
        AND "color_space" = 'srgb'
      ),
      CONSTRAINT "coloring_revisions_byte_size_check" CHECK (
        "outline_byte_size" BETWEEN 1 AND 20971520
        AND "colored_byte_size" BETWEEN 1 AND 20971520
      )
    );
  `);
  return db;
}
