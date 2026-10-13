import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationDirectory = resolve(__dirname, "../prisma/migrations");
const checksum = "a".repeat(64);
const contourChecksum = "b".repeat(64);
const sourceChecksum = "c".repeat(64);
const migration = () =>
  readFile(
    resolve(
      migrationDirectory,
      "20261013180000_pair_material_variant_outlines/migration.sql",
    ),
    "utf8",
  );

async function database(t: TestContext) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE TYPE coloring_status AS ENUM ('draft', 'published', 'archived');
    CREATE TABLE products (id VARCHAR(32) PRIMARY KEY);
    CREATE TABLE colorings (id VARCHAR(32) PRIMARY KEY, status coloring_status, published_revision_id VARCHAR(32));
    CREATE TABLE coloring_revisions (
      id VARCHAR(32) PRIMARY KEY, coloring_id VARCHAR(32), first_published_at TIMESTAMP(3),
      width INTEGER, height INTEGER, derivative_profile TEXT, color_space TEXT, used_color_count INTEGER,
      outline_storage_key TEXT, outline_checksum CHAR(64), outline_byte_size INTEGER,
      outline_source_checksum CHAR(64), outline_source_mime TEXT, outline_alt TEXT,
      colored_storage_key TEXT, colored_checksum CHAR(64), colored_byte_size INTEGER,
      colored_source_checksum CHAR(64), colored_source_mime TEXT, colored_alt TEXT,
      card_storage_key TEXT, card_checksum CHAR(64), card_byte_size INTEGER, card_width INTEGER, card_height INTEGER
    );
    CREATE TABLE coloring_revision_palette_colors (revision_id VARCHAR(32), symbol_position INTEGER, marker_number TEXT, hex TEXT);
    CREATE TABLE historic_work_refs (id TEXT PRIMARY KEY, revision_id TEXT);
    INSERT INTO historic_work_refs VALUES ('work', 'revision');
    INSERT INTO colorings VALUES ('picture', 'published', 'revision');
    INSERT INTO coloring_revisions VALUES (
      'revision', 'picture', '2026-01-01', 1000, 1500, 'webp-preview-v2', 'srgb', 2,
      'legacy/outline.webp', '${contourChecksum}', 900, '${sourceChecksum}', 'image/png', 'Контур Artmate',
      'legacy/colored.webp', '${checksum}', 1000, '${sourceChecksum}', 'image/png', 'Цветная Artmate',
      'legacy/card.webp', '${checksum}', 100, 320, 480
    );
    INSERT INTO coloring_revision_palette_colors VALUES ('revision', 1, '040', '#AABBCC'), ('revision', 2, '051', '#112233');
  `);
  await db.exec(
    await readFile(
      resolve(
        migrationDirectory,
        "20260927180000_add_coloring_material_variants/migration.sql",
      ),
      "utf8",
    ),
  );
  await db.exec(`
    INSERT INTO material_sets (id, slug, title, brand) VALUES ('set', 'artmate-168', 'Artmate', 'Artmate');
    INSERT INTO material_colors (id, material_set_id, code, hex, position) VALUES
      ('color1', 'set', '040', '#AABBCC', 1), ('color2', 'set', '051', '#112233', 2);
    INSERT INTO coloring_artworks (coloring_id, width, height, derivative_profile,
      outline_storage_key, outline_checksum, outline_byte_size, outline_source_checksum, outline_source_mime, outline_alt)
    VALUES ('picture', 1000, 1500, 'webp-preview-v3', 'original/outline.webp', '${checksum}', 800, '${checksum}', 'image/png', 'Оригинал');
    INSERT INTO coloring_originals (coloring_id, image_storage_key, image_checksum, image_byte_size,
      source_checksum, source_mime, image_alt, card_storage_key, card_checksum, card_byte_size, card_width, card_height)
    VALUES ('picture', 'original/colored.webp', '${checksum}', 700, '${checksum}', 'image/png', 'Оригинал', 'original/card.webp', '${checksum}', 70, 320, 480);
    INSERT INTO coloring_material_variants (id, coloring_id, material_set_id, image_storage_key,
      image_checksum, image_byte_size, source_checksum, source_mime, image_alt, card_storage_key,
      card_checksum, card_byte_size, card_width, card_height, status, published_at)
    VALUES ('variant', 'picture', 'set', 'legacy/colored.webp', '${checksum}', 1000, '${sourceChecksum}',
      'image/png', 'Цветная Artmate', 'legacy/card.webp', '${checksum}', 100, 320, 480, 'published', '2026-01-01');
    INSERT INTO coloring_material_assignments (variant_id, material_set_id, material_color_id, symbol_position)
    VALUES ('variant', 'set', 'color1', 1), ('variant', 'set', 'color2', 2);
  `);
  return db;
}

async function snapshot(db: PGlite) {
  const tables = [
    "colorings",
    "coloring_revisions",
    "coloring_artworks",
    "coloring_originals",
    "historic_work_refs",
  ];
  return Promise.all(
    tables.map(
      async (table) => (await db.query(`SELECT * FROM ${table}`)).rows,
    ),
  );
}

describe("Paired material contours migration", () => {
  it("backfills the proven v2 Artmate contour beside the v3 original and preserves history", async (t) => {
    const db = await database(t);
    const before = await snapshot(db);
    await db.exec(await migration());
    assert.deepEqual(
      (
        await db.query(`SELECT outline_storage_key, outline_checksum, outline_byte_size,
      outline_source_checksum, outline_source_mime, outline_alt FROM coloring_material_variants`)
      ).rows,
      [
        {
          outline_storage_key: "legacy/outline.webp",
          outline_checksum: contourChecksum,
          outline_byte_size: 900,
          outline_source_checksum: sourceChecksum,
          outline_source_mime: "image/png",
          outline_alt: "Контур Artmate",
        },
      ],
    );
    assert.deepEqual(await snapshot(db), before);
    for (const field of [
      "outline_storage_key",
      "outline_checksum",
      "outline_byte_size",
      "outline_source_checksum",
      "outline_source_mime",
      "outline_alt",
    ]) {
      await assert.rejects(
        db.exec(`UPDATE coloring_material_variants SET ${field} = NULL`),
        (error: unknown) => (error as { code: string }).code === "23502",
      );
    }
    for (const assignment of [
      "outline_checksum = 'bad'",
      "outline_source_checksum = 'bad'",
      "outline_byte_size = 0",
      "outline_storage_key = ''",
      "outline_storage_key = image_storage_key",
      "outline_storage_key = card_storage_key",
      "outline_source_mime = ''",
      "outline_alt = ''",
    ]) {
      await assert.rejects(
        db.exec(`UPDATE coloring_material_variants SET ${assignment}`),
        (error: unknown) => (error as { code: string }).code === "23514",
      );
    }
    assert.equal(
      (
        await db.query<{ n: number }>(
          `SELECT count(*)::int n FROM pg_indexes WHERE indexname = 'coloring_material_variants_outline_storage_key_key'`,
        )
      ).rows[0]?.n,
      1,
    );
  });

  const unproven = [
    ["another material set", "UPDATE material_sets SET slug = 'other-set'"],
    [
      "changed published revision",
      "UPDATE colorings SET published_revision_id = 'other-revision'",
    ],
    ["mismatched dimensions", "UPDATE coloring_artworks SET width = 999"],
    [
      "unsupported derivative",
      "UPDATE coloring_artworks SET derivative_profile = 'other'",
    ],
    [
      "changed color image",
      "UPDATE coloring_material_variants SET image_checksum = repeat('d', 64)",
    ],
    [
      "changed source",
      "UPDATE coloring_material_variants SET source_checksum = repeat('d', 64)",
    ],
    [
      "changed card",
      "UPDATE coloring_material_variants SET card_storage_key = 'other/card.webp'",
    ],
    [
      "missing symbol",
      "DELETE FROM coloring_material_assignments WHERE symbol_position = 2",
    ],
    [
      "extra symbol",
      "INSERT INTO coloring_material_assignments VALUES ('variant', 'set', 'color1', 3)",
    ],
    [
      "missing legacy symbol",
      "DELETE FROM coloring_revision_palette_colors WHERE symbol_position = 2",
    ],
    [
      "different code with the same HEX",
      "UPDATE material_colors SET code = '40' WHERE id = 'color1'",
    ],
    [
      "different HEX",
      "UPDATE material_colors SET hex = '#AABBCD' WHERE id = 'color1'",
    ],
  ];
  for (const [label, sql] of unproven) {
    it(`rejects ${label} atomically without choosing the original contour`, async (t) => {
      const db = await database(t);
      await db.exec(sql!);
      const before = await snapshot(db);
      await assert.rejects(
        db.exec(await migration()),
        /Cannot prove a paired contour/,
      );
      await db.exec("ROLLBACK");
      assert.deepEqual(await snapshot(db), before);
      assert.equal(
        (
          await db.query<{ n: number }>(
            `SELECT count(*)::int n FROM information_schema.columns WHERE table_name = 'coloring_material_variants' AND column_name = 'outline_storage_key'`,
          )
        ).rows[0]?.n,
        0,
      );
    });
  }
});
