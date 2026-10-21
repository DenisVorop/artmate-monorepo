import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

describe("business form consent provenance migration", () => {
  it("preserves historical acknowledgements and requires real acceptance references for new authenticated records", async () => {
    const db = new PGlite();
    const migration = async (name: string) =>
      db.exec(
        await readFile(
          resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
          "utf8",
        ),
      );
    const insert = (id: string, extra: string, values: string) =>
      db.exec(`
      INSERT INTO partner_applications
      (id, name, email, preferred_contact, channel_url, partner_type, audience_size, consent${extra})
      VALUES ('${id}', 'Actor', 'reply@example.test', 'email', 'https://example.test', 'creator', 'up_to_1000', ${values})
    `);
    try {
      await migration("20260901130000_add_partner_applications");
      await insert("historical", "", "true");
      // A legacy installation may have retained a false acknowledgement. Its
      // lack of proof must survive the migration instead of gaining acceptance.
      await db.exec(
        "ALTER TABLE partner_applications DROP CONSTRAINT partner_applications_consent_check",
      );
      await insert("historical-false", "", "false");
      await db.exec(
        "CREATE TABLE required_consent_acceptances (id TEXT PRIMARY KEY)",
      );
      await migration("20261021100000_business_form_consent_provenance");
      assert.deepEqual(
        (
          await db.query(
            "SELECT consent, authenticated_user_id, consent_acceptance_id FROM partner_applications WHERE id='historical'",
          )
        ).rows,
        [
          {
            consent: true,
            authenticated_user_id: null,
            consent_acceptance_id: null,
          },
        ],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT consent, authenticated_user_id, consent_acceptance_id FROM partner_applications WHERE id='historical-false'",
          )
        ).rows,
        [
          {
            consent: false,
            authenticated_user_id: null,
            consent_acceptance_id: null,
          },
        ],
      );
      await db.exec(
        "INSERT INTO required_consent_acceptances VALUES ('actual-acceptance')",
      );
      await insert(
        "verified",
        ", authenticated_user_id, consent_acceptance_id",
        "NULL, 'actual-user', 'actual-acceptance'",
      );
      for (const [id, value] of [
        ["fabricated", "NULL, 'actual-user', 'fabricated-acceptance'"],
        ["partial", "NULL, 'actual-user', NULL"],
        ["fake-boolean", "true, 'actual-user', 'actual-acceptance'"],
        ["missing", "NULL, NULL, NULL"],
      ])
        await assert.rejects(
          insert(id!, ", authenticated_user_id, consent_acceptance_id", value!),
        );
      await assert.rejects(
        db.exec(
          "DELETE FROM required_consent_acceptances WHERE id='actual-acceptance'",
        ),
      );
    } finally {
      await db.close();
    }
  });
});
