import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("posting migration preserves FBO numbers, enables mixed lists and removes redundant columns", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE orders (id TEXT PRIMARY KEY, ozon_posting_numbers TEXT[] NOT NULL);
      CREATE TABLE delivery_tracking_requests (order_id TEXT PRIMARY KEY, external_numbers TEXT[] NOT NULL);
      INSERT INTO orders VALUES ('old', ARRAY['0123-04-5']), ('empty', ARRAY[]::TEXT[]);
      INSERT INTO delivery_tracking_requests VALUES ('old', ARRAY['0123-04-5']), ('empty', ARRAY[]::TEXT[]);
    `);
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20261019120000_structure_ozon_postings/migration.sql",
        ),
        "utf8",
      ),
    );
    const fbo = { number: "0123-04-5", scheme: "fbo" };
    const fbs = { number: "0123-04-6", scheme: "fbs" };
    for (const table of ["orders", "delivery_tracking_requests"]) {
      const id = table === "orders" ? "id" : "order_id";
      assert.deepEqual(
        (await db.query(`SELECT ozon_postings FROM ${table} ORDER BY ${id}`))
          .rows,
        [{ ozon_postings: [] }, { ozon_postings: [fbo] }],
      );
      await db.query(
        `UPDATE ${table} SET ozon_postings = $1::JSONB WHERE ${id} = 'old'`,
        [JSON.stringify([fbo, fbs])],
      );
      assert.deepEqual(
        (
          await db.query(
            `SELECT ozon_postings FROM ${table} WHERE ozon_postings @> $1::JSONB`,
            [JSON.stringify([{ number: fbs.number }])],
          )
        ).rows,
        [{ ozon_postings: [fbo, fbs] }],
      );
      await assert.rejects(
        db.exec(`UPDATE ${table} SET ozon_postings = '{}'::JSONB`),
        /check constraint/,
      );
      const columns = (
        await db.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
          [table],
        )
      ).rows.map((row) => row.column_name);
      assert.deepEqual(columns.sort(), [id, "ozon_postings"].sort());
    }
  } finally {
    await db.close();
  }
});
