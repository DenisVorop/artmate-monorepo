import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("FBS migration preserves existing FBO numbers and constrains the scheme subset", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, ozon_posting_numbers TEXT[] NOT NULL);
      CREATE TABLE delivery_tracking_requests (order_id TEXT PRIMARY KEY, external_numbers TEXT[] NOT NULL);
      INSERT INTO orders VALUES ('old', ARRAY['0123-04-5']);
      INSERT INTO delivery_tracking_requests VALUES ('old', ARRAY['0123-04-5']);
    `);
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20261019120000_add_ozon_fbs_postings/migration.sql",
        ),
        "utf8",
      ),
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT ozon_posting_numbers, ozon_fbs_posting_numbers FROM orders",
        )
      ).rows,
      [{ ozon_posting_numbers: ["0123-04-5"], ozon_fbs_posting_numbers: [] }],
    );
    assert.deepEqual(
      (
        await db.query(
          "SELECT ozon_fbs_posting_numbers FROM delivery_tracking_requests",
        )
      ).rows,
      [{ ozon_fbs_posting_numbers: [] }],
    );
    for (const table of ["orders", "delivery_tracking_requests"]) {
      await db.exec(
        `UPDATE ${table} SET ozon_fbs_posting_numbers = ARRAY['0123-04-5']`,
      );
      await assert.rejects(
        db.exec(
          `UPDATE ${table} SET ozon_fbs_posting_numbers = ARRAY['other-1-2']`,
        ),
        /check constraint/,
      );
    }
  } finally {
    await db.close();
  }
});
