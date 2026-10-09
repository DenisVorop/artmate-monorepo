import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it, type TestContext } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260927180000_add_coloring_material_variants/migration.sql",
);
const checksum = "a".repeat(64);
const imageColumns = `
  image_storage_key, image_checksum, image_byte_size, source_checksum,
  source_mime, image_alt, card_storage_key, card_checksum, card_byte_size,
  card_width, card_height
`;

function imageValues(key: string) {
  return `
    '${key}/image.webp', '${checksum}', 1000, '${checksum}',
    'image/png', 'Картинка', '${key}/card.webp', '${checksum}', 100, 320, 480
  `;
}

async function database(t: TestContext) {
  const db = new PGlite();
  t.after(() => db.close());
  // Parent tables and historical references are deliberately outside this slice.
  await db.exec(`
    CREATE TYPE coloring_status AS ENUM ('draft', 'published', 'archived');
    CREATE TABLE products (id VARCHAR(32) PRIMARY KEY);
    CREATE TABLE colorings (id VARCHAR(32) PRIMARY KEY);
    CREATE TABLE coloring_revisions (
      id VARCHAR(32) PRIMARY KEY,
      coloring_id VARCHAR(32) NOT NULL REFERENCES colorings(id)
    );
    CREATE TABLE existing_work_refs (
      id TEXT PRIMARY KEY,
      coloring_id VARCHAR(32) NOT NULL REFERENCES colorings(id),
      official_revision_id VARCHAR(32) NOT NULL REFERENCES coloring_revisions(id)
    );
    INSERT INTO products VALUES ('markers-product');
    INSERT INTO colorings VALUES ('picture');
    INSERT INTO coloring_revisions VALUES ('existing-revision', 'picture');
    INSERT INTO existing_work_refs VALUES ('work', 'picture', 'existing-revision');
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

async function seed(db: PGlite) {
  await db.exec(`
    INSERT INTO material_sets (id, slug, title, brand, product_id) VALUES
      ('artmate', 'artmate-168', 'Artmate · 168 цветов', 'Artmate', 'markers-product'),
      ('other', 'other-set', 'Другой набор', 'Other', NULL);
    INSERT INTO material_colors (id, material_set_id, code, hex, position) VALUES
      ('artmate-040', 'artmate', '040', '#FF8844', 0),
      ('other-040', 'other', '040', '#FF8844', 0),
      ('other-b12', 'other', 'B-12', '#aabbcc', 1);
    INSERT INTO coloring_artworks (
      coloring_id, width, height, derivative_profile, outline_storage_key,
      outline_checksum, outline_byte_size, outline_source_checksum,
      outline_source_mime, outline_alt
    ) VALUES (
      'picture', 1000, 1500, 'test-webp', 'picture/outline.webp',
      '${checksum}', 1000, '${checksum}', 'image/png', 'Контуры'
    );
    INSERT INTO coloring_originals (coloring_id, ${imageColumns})
      VALUES ('picture', ${imageValues("original")});
    INSERT INTO coloring_original_colors (coloring_id, symbol_position, hex) VALUES
      ('picture', 1, '#EE7733'), ('picture', 17, '#AABBCC'), ('picture', 18, '#112233');
    INSERT INTO coloring_material_variants (id, coloring_id, material_set_id, ${imageColumns}) VALUES
      ('variant-artmate', 'picture', 'artmate', ${imageValues("artmate")}),
      ('variant-other', 'picture', 'other', ${imageValues("other")});
    INSERT INTO coloring_material_assignments
      (variant_id, material_set_id, material_color_id, symbol_position) VALUES
      ('variant-artmate', 'artmate', 'artmate-040', 1);
  `);
}

async function rejectsCode(db: PGlite, sql: string, code: string) {
  await assert.rejects(db.exec(sql), (error: unknown) => {
    assert.equal((error as { code: string }).code, code);
    return true;
  });
}

describe("Mutable coloring material variants", () => {
  it("expands without changing historical work references or inventing originals", async (t) => {
    const db = await database(t);
    assert.deepEqual(
      (await db.query("SELECT * FROM existing_work_refs")).rows,
      [
        {
          id: "work",
          coloring_id: "picture",
          official_revision_id: "existing-revision",
        },
      ],
    );
    for (const table of [
      "material_sets",
      "coloring_artworks",
      "coloring_originals",
      "coloring_material_variants",
    ]) {
      assert.deepEqual(
        (await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows,
        [{ count: 0 }],
      );
    }
  });

  it("keeps leading zeros, supports alphanumeric codes and scopes uniqueness to a set", async (t) => {
    const db = await database(t);
    await seed(db);
    assert.deepEqual(
      (await db.query("SELECT code FROM material_colors ORDER BY id")).rows,
      [{ code: "040" }, { code: "040" }, { code: "B-12" }],
    );
    // Equal HEX values are allowed: different materials need not be merged.
    await rejectsCode(
      db,
      `
      INSERT INTO material_colors (id, material_set_id, code, hex, position)
      VALUES ('duplicate', 'artmate', '040', '#AABBCC', 1)
    `,
      "23505",
    );
    await rejectsCode(
      db,
      `
      INSERT INTO material_colors (id, material_set_id, code, hex, position)
      VALUES ('duplicate-position', 'artmate', '041', '#AABBCC', 0)
    `,
      "23505",
    );
    await db.exec("DELETE FROM products WHERE id = 'markers-product'");
    assert.equal(
      (
        await db.query<{ product_id: string | null }>(
          "SELECT product_id FROM material_sets WHERE id = 'artmate'",
        )
      ).rows[0]?.product_id,
      null,
    );
  });

  it("allows exactly one original and one current adaptation per set", async (t) => {
    const db = await database(t);
    await seed(db);
    await rejectsCode(
      db,
      `
      INSERT INTO coloring_originals (coloring_id, ${imageColumns})
      VALUES ('picture', ${imageValues("second-original")})
    `,
      "23505",
    );
    await rejectsCode(
      db,
      `
      INSERT INTO coloring_material_variants (id, coloring_id, material_set_id, ${imageColumns})
      VALUES ('second-artmate', 'picture', 'artmate', ${imageValues("second-artmate")})
    `,
      "23505",
    );
    await db.exec(`
      UPDATE coloring_material_variants
      SET image_storage_key = 'artmate/replacement.webp', image_checksum = '${"b".repeat(64)}'
      WHERE id = 'variant-artmate';
      UPDATE coloring_originals SET image_storage_key = 'original/replacement.webp'
      WHERE coloring_id = 'picture';
    `);
    assert.deepEqual(
      (
        await db.query(`
      SELECT id, image_storage_key FROM coloring_material_variants WHERE material_set_id = 'artmate'
    `)
      ).rows,
      [
        {
          id: "variant-artmate",
          image_storage_key: "artmate/replacement.webp",
        },
      ],
    );
    assert.deepEqual(
      (await db.query("SELECT count(*)::int AS count FROM coloring_originals"))
        .rows,
      [{ count: 1 }],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM coloring_material_variants",
        )
      ).rows,
      [{ count: 2 }],
    );
  });

  it("supports Artmate before a genuine original is available, without a fake original", async (t) => {
    const db = await database(t);
    await seed(db);
    await db.exec(
      "DELETE FROM coloring_originals WHERE coloring_id = 'picture'",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM coloring_original_colors",
        )
      ).rows,
      [{ count: 0 }],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM coloring_material_variants",
        )
      ).rows,
      [{ count: 2 }],
    );
  });

  it("rejects cross-set assignments but allows a marker to serve multiple symbols", async (t) => {
    const db = await database(t);
    await seed(db);
    await db.exec(`
      INSERT INTO coloring_material_assignments
        (variant_id, material_set_id, material_color_id, symbol_position) VALUES
        ('variant-artmate', 'artmate', 'artmate-040', 17),
        ('variant-artmate', 'artmate', 'artmate-040', 18);
    `);
    assert.deepEqual(
      (
        await db.query(`
      SELECT symbol_position FROM coloring_material_assignments ORDER BY symbol_position
    `)
      ).rows,
      [
        { symbol_position: 1 },
        { symbol_position: 17 },
        { symbol_position: 18 },
      ],
    );
    for (const setId of ["artmate", "other"]) {
      await rejectsCode(
        db,
        `
        INSERT INTO coloring_material_assignments
          (variant_id, material_set_id, material_color_id, symbol_position)
        VALUES ('variant-artmate', '${setId}', 'other-040', 2)
      `,
        "23503",
      );
    }
    await rejectsCode(
      db,
      `
      INSERT INTO coloring_material_assignments
        (variant_id, material_set_id, material_color_id, symbol_position)
      VALUES ('variant-artmate', 'artmate', 'artmate-040', 1)
    `,
      "23505",
    );
    await rejectsCode(
      db,
      "UPDATE material_colors SET material_set_id = 'other', code = 'new', position = 5 WHERE id = 'artmate-040'",
      "23503",
    );
    await rejectsCode(
      db,
      "DELETE FROM material_colors WHERE id = 'artmate-040'",
      "23503",
    );
    await rejectsCode(
      db,
      "DELETE FROM material_sets WHERE id = 'artmate'",
      "23503",
    );
  });

  it("updates colors in place without copied palette snapshots", async (t) => {
    const db = await database(t);
    await seed(db);
    await db.exec(
      "UPDATE material_colors SET hex = '#123456', code = '041' WHERE id = 'artmate-040'",
    );
    assert.deepEqual(
      (
        await db.query(`
      SELECT c.code, c.hex FROM coloring_material_assignments a
      JOIN material_colors c ON c.id = a.material_color_id AND c.material_set_id = a.material_set_id
      WHERE a.variant_id = 'variant-artmate'
    `)
      ).rows,
      [{ code: "041", hex: "#123456" }],
    );
    assert.deepEqual(
      (
        await db.query(`
      SELECT hex FROM coloring_original_colors WHERE coloring_id = 'picture' AND symbol_position = 1
    `)
      ).rows,
      [{ hex: "#EE7733" }],
    );
  });

  it("enforces valid color, symbol, image and publication fields", async (t) => {
    const db = await database(t);
    await seed(db);
    const invalidUpdates = [
      "UPDATE material_colors SET hex = '#GG0000' WHERE id = 'artmate-040'",
      "UPDATE material_colors SET code = ' 040' WHERE id = 'artmate-040'",
      "UPDATE material_colors SET code = '' WHERE id = 'artmate-040'",
      "UPDATE material_colors SET position = -1 WHERE id = 'artmate-040'",
      "UPDATE coloring_original_colors SET hex = 'red'",
      "UPDATE coloring_original_colors SET symbol_position = 0 WHERE symbol_position = 1",
      "UPDATE coloring_material_assignments SET symbol_position = 20",
      "UPDATE coloring_artworks SET width = 0",
      "UPDATE coloring_artworks SET width = 8000, height = 8000",
      "UPDATE coloring_artworks SET outline_checksum = 'bad'",
      "UPDATE coloring_artworks SET outline_byte_size = 0",
      "UPDATE coloring_artworks SET color_space = 'cmyk'",
      "UPDATE coloring_originals SET image_byte_size = -1",
      "UPDATE coloring_originals SET image_checksum = 'bad'",
      "UPDATE coloring_originals SET card_width = 641",
      "UPDATE coloring_material_variants SET card_storage_key = '' WHERE id = 'variant-artmate'",
      "UPDATE coloring_material_variants SET image_storage_key = card_storage_key WHERE id = 'variant-artmate'",
      "UPDATE coloring_material_variants SET status = 'published' WHERE id = 'variant-artmate'",
      "UPDATE coloring_originals SET status = 'published'",
    ];
    for (const sql of invalidUpdates) await rejectsCode(db, sql, "23514");
    await db.exec(`
      UPDATE coloring_material_variants SET status = 'published', published_at = CURRENT_TIMESTAMP;
      UPDATE coloring_originals SET status = 'published', published_at = CURRENT_TIMESTAMP;
    `);
  });

  it("removes only an adaptation's assignments when that adaptation is removed", async (t) => {
    const db = await database(t);
    await seed(db);
    await rejectsCode(
      db,
      "DELETE FROM coloring_artworks WHERE coloring_id = 'picture'",
      "23503",
    );
    await db.exec(
      "DELETE FROM coloring_material_variants WHERE id = 'variant-artmate'",
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT count(*)::int AS count FROM coloring_material_assignments",
        )
      ).rows,
      [{ count: 0 }],
    );
    for (const table of [
      "colorings",
      "coloring_artworks",
      "coloring_originals",
      "existing_work_refs",
    ]) {
      assert.deepEqual(
        (await db.query(`SELECT count(*)::int AS count FROM ${table}`)).rows,
        [{ count: 1 }],
      );
    }
  });
});
