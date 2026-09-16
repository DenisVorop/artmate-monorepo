import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260916160000_shipping_package_profiles/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE products (
      id VARCHAR(32) PRIMARY KEY,
      slug VARCHAR(180) NOT NULL,
      title TEXT NOT NULL,
      price INTEGER NOT NULL
    );
    INSERT INTO products VALUES
      ('album', 'album', 'Альбом', 79900),
      ('album2', 'album-2', 'Альбом 2', 89900),
      ('cmpyaoifi000701qio3irdekb', 'raskraska-po-nomeram-fantasy', 'Раскраска по номерам «Фэнтези», 25 картин', 99000),
      ('markers', 'markers', 'Маркеры', 199000),
      ('product_markers_artmate_168', 'akrilovye-markery-artmate-168-cvetov', 'Маркеры Artmate', 299000),
      ('marker-lookalike', 'marker-lookalike', 'Маркеры для скетчинга', 123000),
      ('marker-slug-lookalike', 'akrilovye-markery-artmate-168-cvetov', 'Другой товар', 123000);
  `);
  return db;
}

async function applyMigration(db: PGlite) {
  await db.exec(await readFile(migrationPath, "utf8"));
}

describe("Shipping package profiles schema migration", () => {
  it("preserves existing products and prices without guessing profiles", async () => {
    const db = await createDatabase();
    try {
      const before = await db.query(
        "SELECT id, slug, title, price FROM products ORDER BY id",
      );
      await applyMigration(db);

      assert.deepEqual(
        (
          await db.query(
            "SELECT id, slug, title, price FROM products ORDER BY id",
          )
        ).rows,
        before.rows,
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT id, shipping_package_profile_id FROM products ORDER BY id",
          )
        ).rows,
        [
          { id: "album", shipping_package_profile_id: null },
          { id: "album2", shipping_package_profile_id: null },
          {
            id: "cmpyaoifi000701qio3irdekb",
            shipping_package_profile_id: "shipping_album",
          },
          { id: "marker-lookalike", shipping_package_profile_id: null },
          { id: "marker-slug-lookalike", shipping_package_profile_id: null },
          { id: "markers", shipping_package_profile_id: null },
          {
            id: "product_markers_artmate_168",
            shipping_package_profile_id: "shipping_markers",
          },
        ],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT id, code, weight_grams, length_cm, width_cm, height_cm FROM shipping_package_profiles",
          )
        ).rows,
        [
          {
            id: "shipping_markers",
            code: "markers",
            weight_grams: 2600,
            length_cm: 31,
            width_cm: 16,
            height_cm: 11,
          },
          {
            id: "shipping_album",
            code: "album",
            weight_grams: 400,
            length_cm: 40,
            width_cm: 30,
            height_cm: 1,
          },
        ],
      );
    } finally {
      await db.close();
    }
  });

  it("reuses an album profile while keeping markers on a distinct profile", async () => {
    const db = await createDatabase();
    try {
      await applyMigration(db);
      await db.exec(`
        INSERT INTO shipping_package_profiles
          (id, code, weight_grams, length_cm, width_cm, height_cm)
        VALUES
          ('album-profile', 'album-test-code', 400, 40, 30, 1),
          ('markers-profile', 'markers-synthetic', 800, 25, 20, 10);
        UPDATE products SET shipping_package_profile_id = 'album-profile'
          WHERE id IN ('album', 'album2');
        UPDATE products SET shipping_package_profile_id = 'markers-profile'
          WHERE id = 'markers';
      `);

      assert.deepEqual(
        (
          await db.query(
            "SELECT id, shipping_package_profile_id FROM products ORDER BY id",
          )
        ).rows,
        [
          { id: "album", shipping_package_profile_id: "album-profile" },
          { id: "album2", shipping_package_profile_id: "album-profile" },
          {
            id: "cmpyaoifi000701qio3irdekb",
            shipping_package_profile_id: "shipping_album",
          },
          { id: "marker-lookalike", shipping_package_profile_id: null },
          { id: "marker-slug-lookalike", shipping_package_profile_id: null },
          { id: "markers", shipping_package_profile_id: "markers-profile" },
          {
            id: "product_markers_artmate_168",
            shipping_package_profile_id: "shipping_markers",
          },
        ],
      );
    } finally {
      await db.close();
    }
  });

  it("rejects invalid dimensions, codes, duplicates, and missing profiles", async () => {
    const db = await createDatabase();
    try {
      await applyMigration(db);
      const invalidDimensions = [
        [0, 40, 30, 1],
        [-1, 40, 30, 1],
        [400, 0, 30, 1],
        [400, 40, -1, 1],
        [400, 40, 30, 0],
        [null, 40, 30, 1],
      ] as const;
      for (const [weight, length, width, height] of invalidDimensions) {
        await assert.rejects(
          db.query(
            "INSERT INTO shipping_package_profiles (id, code, weight_grams, length_cm, width_cm, height_cm) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              `invalid-${String(weight)}-${String(length)}-${String(width)}-${String(height)}`,
              `invalid-${String(weight)}`,
              weight,
              length,
              width,
              height,
            ],
          ),
        );
      }
      for (const [index, code] of [
        "",
        "Album",
        "1album",
        "album space",
        "a".repeat(65),
      ].entries()) {
        await assert.rejects(
          db.query(
            "INSERT INTO shipping_package_profiles (id, code, weight_grams, length_cm, width_cm, height_cm) VALUES ($1, $2, 400, 40, 30, 1)",
            [`bad-code-${index}`, code],
          ),
        );
      }
      await db.exec(
        "INSERT INTO shipping_package_profiles VALUES ('album-profile', 'album-test-code', 400, 40, 30, 1)",
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO shipping_package_profiles VALUES ('album-profile-2', 'album', 400, 40, 30, 1)",
        ),
      );
      await assert.rejects(
        db.exec(
          "UPDATE products SET shipping_package_profile_id = 'missing' WHERE id = 'album'",
        ),
      );
    } finally {
      await db.close();
    }
  });

  it("does not bind the known product id when its slug is not the exact target", async () => {
    const db = await createDatabase();
    try {
      await db.exec(
        "UPDATE products SET slug = 'different-slug' WHERE id = 'product_markers_artmate_168'",
      );
      await applyMigration(db);
      assert.deepEqual(
        (
          await db.query(
            "SELECT shipping_package_profile_id FROM products WHERE id = 'product_markers_artmate_168'",
          )
        ).rows,
        [{ shipping_package_profile_id: null }],
      );
    } finally {
      await db.close();
    }
  });

  it("does not bind the known album id when its slug is not the exact target", async () => {
    const db = await createDatabase();
    try {
      await db.exec(
        "UPDATE products SET slug = 'different-album-slug' WHERE id = 'cmpyaoifi000701qio3irdekb'",
      );
      await applyMigration(db);
      assert.deepEqual(
        (
          await db.query(
            "SELECT shipping_package_profile_id FROM products WHERE id = 'cmpyaoifi000701qio3irdekb'",
          )
        ).rows,
        [{ shipping_package_profile_id: null }],
      );
    } finally {
      await db.close();
    }
  });

  it("restricts assigned profile deletion, then allows unlinking, and retains profiles when products are deleted", async () => {
    const db = await createDatabase();
    try {
      await applyMigration(db);
      await db.exec(
        "INSERT INTO shipping_package_profiles VALUES ('album-profile', 'album-test-code', 400, 40, 30, 1)",
      );
      await db.exec(
        "UPDATE products SET shipping_package_profile_id = 'album-profile' WHERE id = 'album'",
      );
      await assert.rejects(
        db.exec(
          "DELETE FROM shipping_package_profiles WHERE id = 'album-profile'",
        ),
      );
      await db.exec(
        "UPDATE products SET shipping_package_profile_id = NULL WHERE id = 'album'",
      );
      await db.exec(
        "DELETE FROM shipping_package_profiles WHERE id = 'album-profile'",
      );

      await db.exec(
        "INSERT INTO shipping_package_profiles VALUES ('markers-profile', 'markers-synthetic', 800, 25, 20, 10)",
      );
      await db.exec(
        "UPDATE products SET shipping_package_profile_id = 'markers-profile' WHERE id = 'markers'",
      );
      await db.exec("DELETE FROM products WHERE id = 'markers'");
      assert.deepEqual(
        (await db.query("SELECT id FROM shipping_package_profiles ORDER BY id"))
          .rows,
        [
          { id: "markers-profile" },
          { id: "shipping_album" },
          { id: "shipping_markers" },
        ],
      );
    } finally {
      await db.close();
    }
  });
});
