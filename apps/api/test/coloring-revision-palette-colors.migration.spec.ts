import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPaths = [
  "../prisma/migrations/20260830160000_add_coloring_revision_palette_colors/migration.sql",
  "../prisma/migrations/20260830200000_expand_coloring_palette_to_19/migration.sql",
].map((migrationPath) => resolve(__dirname, migrationPath));

describe("Coloring revision palette colors migration", () => {
  it("stores ordered marker snapshots and cascades with a revision", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        INSERT INTO "coloring_revisions" ("id") VALUES ('revision-1');
        INSERT INTO "marker_colors" ("id") VALUES
          ('marker-color-104'),
          ('marker-color-001');
        INSERT INTO "coloring_revision_palette_colors" (
          "revision_id", "marker_color_id", "symbol_position", "color_number",
          "pantone", "hex", "marker_number"
        ) VALUES
          ('revision-1', 'marker-color-104', 1, 104, '11-0601TCX', '#F4F9FF', '006'),
          ('revision-1', 'marker-color-001', 2, 1, '11-0601 TPG', '#F5F7F6', '600');
      `);

      const stored = await db.query<{
        colorNumber: number;
        hex: string;
        markerColorId: string;
        markerNumber: string;
        pantone: string;
        symbolPosition: number;
      }>(`
        SELECT
          "marker_color_id" AS "markerColorId",
          "symbol_position" AS "symbolPosition",
          "color_number" AS "colorNumber",
          "pantone",
          "hex",
          "marker_number" AS "markerNumber"
        FROM "coloring_revision_palette_colors"
        ORDER BY "symbol_position"
      `);

      assert.deepEqual(stored.rows, [
        {
          markerColorId: "marker-color-104",
          symbolPosition: 1,
          colorNumber: 104,
          pantone: "11-0601TCX",
          hex: "#F4F9FF",
          markerNumber: "006",
        },
        {
          markerColorId: "marker-color-001",
          symbolPosition: 2,
          colorNumber: 1,
          pantone: "11-0601 TPG",
          hex: "#F5F7F6",
          markerNumber: "600",
        },
      ]);

      await assert.rejects(
        db.exec(`DELETE FROM "marker_colors" WHERE "id" = 'marker-color-104'`),
      );
      await db.exec(
        `DELETE FROM "coloring_revisions" WHERE "id" = 'revision-1'`,
      );
      const count = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM "coloring_revision_palette_colors"
      `);

      assert.equal(count.rows[0]?.count, 0);
    } finally {
      await db.close();
    }
  });

  it("enforces symbol range, unique markers per revision and snapshot formats", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`
        INSERT INTO "coloring_revisions" ("id") VALUES ('revision-1');
        INSERT INTO "marker_colors" ("id") VALUES
          ('marker-color-104'),
          ('marker-color-001'),
          ('marker-color-019');
        ${insertAssignment()};
      `);

      await db.exec(
        insertAssignment({ markerColorId: "marker-color-019", position: 19 }),
      );

      await rejectsConstraint(
        db,
        insertAssignment({ markerColorId: "marker-color-001" }),
      );
      await rejectsConstraint(
        db,
        insertAssignment({ markerColorId: "marker-color-104", position: 2 }),
      );
      await rejectsConstraint(
        db,
        insertAssignment({ markerColorId: "marker-color-001", position: 0 }),
      );
      await rejectsConstraint(
        db,
        insertAssignment({ markerColorId: "marker-color-001", position: 20 }),
      );
      await rejectsConstraint(
        db,
        insertAssignment({
          markerColorId: "marker-color-001",
          position: 2,
          hex: "#abcdef",
        }),
      );
      await rejectsConstraint(
        db,
        insertAssignment({
          markerColorId: "marker-color-001",
          position: 2,
          markerNumber: "27",
        }),
      );
    } finally {
      await db.close();
    }
  });
});

async function createDatabase() {
  const db = new PGlite();

  await db.exec(`
    CREATE TABLE "coloring_revisions" (
      "id" VARCHAR(32) PRIMARY KEY
    );
    CREATE TABLE "marker_colors" (
      "id" VARCHAR(32) PRIMARY KEY
    );
  `);
  for (const migrationPath of migrationPaths) {
    await db.exec(await readFile(migrationPath, "utf8"));
  }

  return db;
}

async function rejectsConstraint(db: PGlite, sql: string) {
  await assert.rejects(db.exec(sql));
}

function insertAssignment(
  overrides: Partial<{
    hex: string;
    markerColorId: string;
    markerNumber: string;
    position: number;
  }> = {},
) {
  return `
    INSERT INTO "coloring_revision_palette_colors" (
      "revision_id", "marker_color_id", "symbol_position", "color_number",
      "pantone", "hex", "marker_number"
    ) VALUES (
      'revision-1',
      '${overrides.markerColorId ?? "marker-color-104"}',
      ${overrides.position ?? 1},
      104,
      '11-0601TCX',
      '${overrides.hex ?? "#F4F9FF"}',
      '${overrides.markerNumber ?? "006"}'
    )
  `;
}
