import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

describe("delivery cache replacement migration", () => {
  it("drops only the disposable Ozon index and preserves OAuth data", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE ozon_oauth_tokens (id TEXT PRIMARY KEY, access_token TEXT NOT NULL);
        INSERT INTO ozon_oauth_tokens VALUES ('token-1', 'keep-me');
      `);
      await db.exec(await migration("20260907170000_add_ozon_pickup_index"));
      await db.exec(
        await migration(
          "20260908120000_replace_ozon_pickup_index_with_delivery_cache",
        ),
      );

      const token = await db.query<{ accessToken: string }>(
        `SELECT access_token AS "accessToken" FROM ozon_oauth_tokens`,
      );
      assert.deepEqual(token.rows, [{ accessToken: "keep-me" }]);
      const tables = await db.query<{ name: string }>(`
        SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = 'public' ORDER BY table_name
      `);
      assert.deepEqual(
        tables.rows.map((row) => row.name),
        [
          "delivery_cache_entries",
          "nominatim_rate_limits",
          "ozon_oauth_tokens",
        ],
      );
    } finally {
      await db.close();
    }
  });

  it("allows 32 MiB only for the global point list", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        await migration(
          "20260908120000_replace_ozon_pickup_index_with_delivery_cache",
        ),
      );
      await db.exec(
        `INSERT INTO delivery_cache_entries (key, byte_size) VALUES ('ozon:point-list', 33554432)`,
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO delivery_cache_entries (key, byte_size) VALUES ('ozon:city:44', 5242881)`,
        ),
        /delivery_cache_entries_byte_size_check/u,
      );
      await assert.rejects(
        db.exec(
          `UPDATE delivery_cache_entries SET byte_size = 33554433 WHERE key = 'ozon:point-list'`,
        ),
        /delivery_cache_entries_byte_size_check/u,
      );
    } finally {
      await db.close();
    }
  });
});

async function migration(name: string) {
  return readFile(
    resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
    "utf8",
  );
}
