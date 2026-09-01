import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260901130000_add_partner_applications/migration.sql",
);

describe("partner applications migration", () => {
  it("creates the lead table with safe defaults and invariants", async () => {
    const db = new PGlite();

    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(`
        INSERT INTO "partner_applications" (
          "id", "name", "email", "preferred_contact", "channel_url",
          "partner_type", "audience_size", "consent"
        ) VALUES (
          'application-1', 'Анна', 'anna@example.com', 'email',
          'https://example.com/anna', 'creator', '1000_10000', true
        )
      `);

      const result = await db.query<{
        status: string;
        createdAt: Date;
        updatedAt: Date;
      }>(`
        SELECT "status"::text AS "status", "created_at" AS "createdAt",
               "updated_at" AS "updatedAt"
        FROM "partner_applications"
        WHERE "id" = 'application-1'
      `);
      assert.equal(result.rows[0]?.status, "new");
      assert.ok(result.rows[0]?.createdAt);
      assert.ok(result.rows[0]?.updatedAt);

      await assert.rejects(
        db.exec(`
          INSERT INTO "partner_applications" (
            "id", "name", "email", "preferred_contact", "channel_url",
            "partner_type", "audience_size", "consent"
          ) VALUES (
            'application-2', 'Бот', 'bot@example.com', 'email',
            'https://example.com/bot', 'creator', 'up_to_1000', false
          )
        `),
      );
      await assert.rejects(
        db.exec(`
          INSERT INTO "partner_applications" (
            "id", "name", "email", "preferred_contact", "channel_url",
            "partner_type", "audience_size", "consent"
          ) VALUES (
            'application-3', 'Анна', 'anna-telegram@example.com', 'telegram',
            'https://t.me/anna', 'creator', 'up_to_1000', true
          )
        `),
      );
    } finally {
      await db.close();
    }
  });
});
