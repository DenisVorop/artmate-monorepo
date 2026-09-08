import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

it("migrates durable Ozon rechecks with unique orders, cascade deletion and a due index", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE "orders" ("id" VARCHAR(32) PRIMARY KEY)');
    await db.exec(
      await readFile(
        resolve(
          __dirname,
          "../prisma/migrations/20260908140000_add_ozon_payment_rechecks/migration.sql",
        ),
        "utf8",
      ),
    );
    await db.query('INSERT INTO "orders" ("id") VALUES ($1)', [
      "order-recheck",
    ]);

    const insert = (orderId: string) =>
      db.query(
        `INSERT INTO "order_ozon_payment_rechecks"
        ("order_id", "next_attempt_at", "updated_at")
       VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [orderId],
      );
    await insert("order-recheck");
    const initial = await db.query<{
      attempts: number;
      leaseToken: string | null;
      lockedUntil: Date | null;
      finishedAt: Date | null;
    }>(`SELECT "attempts", "lease_token" AS "leaseToken",
         "locked_until" AS "lockedUntil", "finished_at" AS "finishedAt"
       FROM "order_ozon_payment_rechecks"`);
    assert.deepEqual(initial.rows, [
      {
        attempts: 0,
        leaseToken: null,
        lockedUntil: null,
        finishedAt: null,
      },
    ]);

    await assert.rejects(insert("order-recheck"), { code: "23505" });
    await assert.rejects(insert("unknown-order"), { code: "23503" });
    for (const assignment of [
      '"attempts" = -1',
      "\"lease_token\" = '00000000-0000-4000-8000-000000000001'",
      '"locked_until" = CURRENT_TIMESTAMP',
      "\"last_error\" = 'PRIVATE: provider body'",
    ]) {
      await assert.rejects(
        db.query(`UPDATE "order_ozon_payment_rechecks" SET ${assignment}`),
        { code: "23514" },
      );
    }

    const indexes = await db.query<{ indexdef: string }>(
      "SELECT indexdef FROM pg_indexes WHERE tablename = $1",
      ["order_ozon_payment_rechecks"],
    );
    assert.ok(
      indexes.rows.some(
        ({ indexdef }) =>
          !indexdef.includes("UNIQUE") && indexdef.includes("next_attempt_at"),
      ),
    );

    await db.query('DELETE FROM "orders" WHERE "id" = $1', ["order-recheck"]);
    assert.equal(
      (await db.query('SELECT "order_id" FROM "order_ozon_payment_rechecks"'))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
