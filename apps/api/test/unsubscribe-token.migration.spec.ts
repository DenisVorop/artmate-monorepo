import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { UnsubscribeToken } from "../src/consents/unsubscribe-token";

describe("persistent unsubscribe capability migration", () => {
  it("retains multiple hash-only capabilities across permission changes, rejects malformed/duplicate/orphan hashes and prevents cascading loss", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "CREATE TABLE email_advertising_subscriptions (id TEXT PRIMARY KEY, state TEXT NOT NULL); INSERT INTO email_advertising_subscriptions VALUES ('subscription', 'active')",
      );
      await db.exec(
        await readFile(
          resolve(
            __dirname,
            "../prisma/migrations/20261021110000_email_advertising_unsubscribe/migration.sql",
          ),
          "utf8",
        ),
      );
      const first = UnsubscribeToken.create();
      const second = UnsubscribeToken.create();
      const insert = (
        id: string,
        hash: string,
        subscription = "subscription",
      ) =>
        db.query(
          "INSERT INTO email_advertising_unsubscribe_tokens (id,subscription_id,token_hash,created_at) VALUES ($1,$2,$3,'2000-01-01')",
          [id, subscription, hash],
        );
      await insert("first", first.hash);
      await insert("second", second.hash);
      await db.exec(
        "UPDATE email_advertising_subscriptions SET state='revoked'; UPDATE email_advertising_subscriptions SET state='active'",
      );
      const stored = (
        await db.query("SELECT * FROM email_advertising_unsubscribe_tokens")
      ).rows;
      assert.equal(stored.length, 2);
      assert.equal(JSON.stringify(stored).includes(first.token), false);
      assert.equal(JSON.stringify(stored).includes(second.token), false);
      const columns = (
        await db.query<{ column_name: string }>(
          "SELECT column_name FROM information_schema.columns WHERE table_name='email_advertising_unsubscribe_tokens' ORDER BY ordinal_position",
        )
      ).rows.map((row) => row.column_name);
      assert.deepEqual(columns, [
        "id",
        "subscription_id",
        "token_hash",
        "created_at",
      ]);
      await assert.rejects(insert("duplicate", first.hash));
      await assert.rejects(
        insert("orphan", UnsubscribeToken.create().hash, "missing"),
      );
      await assert.rejects(insert("malformed", "x".repeat(64)));
      await assert.rejects(
        db.exec(
          "DELETE FROM email_advertising_subscriptions WHERE id='subscription'",
        ),
      );
    } finally {
      await db.close();
    }
  });
});
