import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260916090000_product_characteristics/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE products (id VARCHAR(32) PRIMARY KEY, title TEXT NOT NULL, price INTEGER NOT NULL);
    INSERT INTO products VALUES ('markers', 'Маркеры', 199000), ('album', 'Альбом', 79900);`);
  return db;
}

describe("Product characteristics schema migration", () => {
  it("preserves existing products and prices without inventing characteristics", async () => {
    const db = await createDatabase();
    try {
      const before = await db.query(
        "SELECT id, title, price FROM products ORDER BY id",
      );
      await db.exec(await readFile(migrationPath, "utf8"));
      assert.deepEqual(
        (await db.query("SELECT id, title, price FROM products ORDER BY id"))
          .rows,
        before.rows,
      );
      assert.deepEqual(
        (await db.query("SELECT DISTINCT usage_instructions FROM products"))
          .rows,
        [{ usage_instructions: null }],
      );
      assert.equal(
        (await db.query("SELECT * FROM product_characteristics")).rows.length,
        0,
      );
    } finally {
      await db.close();
    }
  });

  it("stores ordered rows, rejects duplicate names or positions, and cascades product deletion", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(`INSERT INTO product_characteristics (id, product_id, name, value, is_highlighted, sort_order) VALUES
        ('row2', 'markers', 'Tip', 'Brush', false, 1), ('row1', 'markers', 'Colours', '168', true, 0);`);
      assert.deepEqual(
        (
          await db.query(
            "SELECT name, value, is_highlighted FROM product_characteristics WHERE product_id = 'markers' ORDER BY sort_order",
          )
        ).rows,
        [
          { name: "Colours", value: "168", is_highlighted: true },
          { name: "Tip", value: "Brush", is_highlighted: false },
        ],
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('duplicate-name', 'markers', ' COLOURS ', '24', 2)",
        ),
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('duplicate-order', 'markers', 'Other', '24', 1)",
        ),
      );
      await db.exec(
        "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('album-row', 'album', 'Colours', '25', 0)",
      );
      await db.exec("DELETE FROM products WHERE id = 'markers'");
      assert.deepEqual(
        (await db.query("SELECT id FROM product_characteristics")).rows,
        [{ id: "album-row" }],
      );
    } finally {
      await db.close();
    }
  });

  it("rejects malformed row data and instructions at the database boundary", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      for (const [name, value, sortOrder] of [
        ["", "1", 0],
        [" ", "1", 0],
        ["name", "", 0],
        ["name", " ", 0],
        ["<b>name</b>", "1", 0],
        ["name", "<img>", 0],
        ["n".repeat(81), "1", 0],
        ["name", "v".repeat(501), 0],
        ["name", "1", -1],
        ["name", "1", 30],
      ] as const) {
        await assert.rejects(
          db.query(
            "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('invalid', 'markers', $1, $2, $3)",
            [name, value, sortOrder],
          ),
        );
      }
      for (const text of ["", "x".repeat(6001), "<script>bad()</script>"]) {
        await assert.rejects(
          db.query(
            "UPDATE products SET usage_instructions = $1 WHERE id = 'markers'",
            [text],
          ),
        );
      }
      await db.query(
        "UPDATE products SET usage_instructions = $1 WHERE id = 'markers'",
        ["Встряхните.\nЗакройте."],
      );
      await db.exec(
        "UPDATE products SET usage_instructions = NULL WHERE id = 'markers'",
      );
    } finally {
      await db.close();
    }
  });

  it("rolls back row replacement and product fields together when a nested row is invalid", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(
        "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('row', 'markers', 'Colours', '168', 0)",
      );
      await db.exec(
        "BEGIN; UPDATE products SET title = 'Changed' WHERE id = 'markers'; DELETE FROM product_characteristics WHERE product_id = 'markers';",
      );
      await assert.rejects(
        db.exec(
          "INSERT INTO product_characteristics (id, product_id, name, value, sort_order) VALUES ('bad', 'markers', '', '24', 0)",
        ),
      );
      await db.exec("ROLLBACK");
      assert.deepEqual(
        (await db.query("SELECT title FROM products WHERE id = 'markers'"))
          .rows,
        [{ title: "Маркеры" }],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT name, value FROM product_characteristics WHERE product_id = 'markers'",
          )
        ).rows,
        [{ name: "Colours", value: "168" }],
      );
    } finally {
      await db.close();
    }
  });
});
