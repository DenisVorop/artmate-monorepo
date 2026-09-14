import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260908160000_add_order_checkout_actor/migration.sql",
);

describe("order checkout actor schema", () => {
  it("stores a nullable actor snapshot without a user relation", async () => {
    const schema = await readFile(
      resolve(__dirname, "../prisma/schema/orders.prisma"),
      "utf8",
    );

    assert.match(
      schema,
      /checkoutActorUserId\s+String\?\s+@map\("checkout_actor_user_id"\)/,
    );
    assert.doesNotMatch(
      schema,
      /@relation\([^)]*fields:\s*\[checkoutActorUserId\]/,
    );
  });

  it("backfills guest and authenticated origins and preserves the actor after owner changes", async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE "orders" (
          "id" VARCHAR(32) PRIMARY KEY,
          "user_id" TEXT
        );
        CREATE TABLE "order_history" (
          "id" VARCHAR(32) PRIMARY KEY,
          "order_id" VARCHAR(32) NOT NULL REFERENCES "orders"("id"),
          "author_id" TEXT,
          "event_type" TEXT NOT NULL,
          "payload" JSONB
        );
      `);

      const cases = [
        {
          id: "pending-guest",
          owner: null,
          actor: null,
          history: { author: null, event: "status_changed", source: "order_created" },
        },
        {
          id: "prelinked-paid-guest",
          owner: "guest-account",
          actor: null,
          history: { author: null, event: "status_changed", source: "order_created" },
        },
        {
          id: "authenticated-origin",
          owner: "authenticated-user",
          actor: "authenticated-user",
          history: { author: "authenticated-user", event: "status_changed", source: "order_created" },
        },
        {
          id: "historyless-linked",
          owner: "legacy-owner",
          actor: "legacy-owner",
          history: null,
        },
        {
          id: "historyless-unlinked",
          owner: null,
          actor: null,
          history: null,
        },
        {
          id: "unrelated-event",
          owner: "event-owner",
          actor: "event-owner",
          history: { author: null, event: "payment_changed", source: "order_created" },
        },
        {
          id: "unrelated-source",
          owner: "source-owner",
          actor: "source-owner",
          history: { author: null, event: "status_changed", source: "payment_notification" },
        },
      ];
      for (const entry of cases) {
        await db.query('INSERT INTO "orders" ("id", "user_id") VALUES ($1, $2)', [
          entry.id,
          entry.owner,
        ]);
        if (entry.history) {
          await db.query(
            `INSERT INTO "order_history"
             ("id", "order_id", "author_id", "event_type", "payload")
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [
              `history-${entry.id}`,
              entry.id,
              entry.history.author,
              entry.history.event,
              JSON.stringify({ source: entry.history.source }),
            ],
          );
        }
      }

      await db.exec(await readFile(migrationPath, "utf8"));

      const readOrder = async (id: string) =>
        (
          await db.query<{ owner: string | null; actor: string | null }>(
            `SELECT "user_id" AS "owner", "checkout_actor_user_id" AS "actor"
             FROM "orders" WHERE "id" = $1`,
            [id],
          )
        ).rows[0];
      for (const entry of cases) {
        assert.deepEqual(
          await readOrder(entry.id),
          { owner: entry.owner, actor: entry.actor },
          entry.id,
        );
        await db.query('UPDATE "orders" SET "user_id" = $1 WHERE "id" = $2', [
          "replacement-owner",
          entry.id,
        ]);
        assert.deepEqual(
          await readOrder(entry.id),
          { owner: "replacement-owner", actor: entry.actor },
          `Owner reassignment must preserve the actor for ${entry.id}`,
        );
      }

      await db.query('UPDATE "orders" SET "user_id" = NULL');
      for (const entry of cases) {
        assert.deepEqual(await readOrder(entry.id), { owner: null, actor: entry.actor });
      }
      await db.query('INSERT INTO "orders" ("id") VALUES ($1)', ["new-guest"]);
      assert.deepEqual(await readOrder("new-guest"), { owner: null, actor: null });

      const columns = await db.query<{ isNullable: string; dataType: string }>(`
        SELECT is_nullable AS "isNullable", data_type AS "dataType"
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders'
          AND column_name = 'checkout_actor_user_id'
      `);
      assert.deepEqual(columns.rows, [{ isNullable: "YES", dataType: "text" }]);
    } finally {
      await db.close();
    }
  });
});
