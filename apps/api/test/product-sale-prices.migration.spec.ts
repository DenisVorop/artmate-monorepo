import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

it("adds sale prices without changing existing prices and enforces their bounds", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "CREATE TABLE products (id TEXT PRIMARY KEY, price INTEGER NOT NULL); INSERT INTO products VALUES ('album', 79900);",
    );
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20261011120000_product_sale_prices/migration.sql",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      (await db.query("SELECT price, sale_price FROM products")).rows,
      [{ price: 79900, sale_price: null }],
    );
    await db.exec("UPDATE products SET sale_price=69900");
    for (const invalid of [0, -100, 79900, 80000, 69899]) {
      await assert.rejects(
        db.exec(`UPDATE products SET sale_price=${invalid}`),
      );
    }
    await assert.rejects(db.exec("UPDATE products SET price=65000"));
    await db.exec("UPDATE products SET price=65000, sale_price=NULL");
    assert.deepEqual(
      (await db.query("SELECT price, sale_price FROM products")).rows,
      [{ price: 65000, sale_price: null }],
    );
  } finally {
    await db.close();
  }
});
