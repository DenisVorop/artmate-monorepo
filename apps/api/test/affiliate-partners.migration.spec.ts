import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260916170000_add_affiliate_partners/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();

  await db.exec(`
    CREATE TYPE "user_role" AS ENUM ('customer', 'admin');
    CREATE TABLE "users" (
      "id" TEXT PRIMARY KEY,
      "roles" "user_role"[] NOT NULL DEFAULT ARRAY['customer']::"user_role"[]
    );
    CREATE TABLE "partner_applications" (
      "id" VARCHAR(32) PRIMARY KEY
    );
    INSERT INTO "users" ("id") VALUES
      ('partner-user-1'),
      ('partner-user-2'),
      ('partner-user-3'),
      ('partner-user-4'),
      ('admin-user-1');
    INSERT INTO "partner_applications" ("id") VALUES
      ('application-1'),
      ('application-2');
  `);
  await db.exec(await readFile(migrationPath, "utf8"));

  return db;
}

async function insertPartner(
  db: PGlite,
  {
    id,
    userId,
    applicationId = null,
    minimumPayoutKopecks = null,
    status = "active",
  }: {
    id: string;
    userId: string;
    applicationId?: string | null;
    minimumPayoutKopecks?: bigint | null;
    status?: string;
  },
) {
  await db.query(
    `
      INSERT INTO "affiliate_partners" (
        "id", "user_id", "partner_application_id", "status",
        "minimum_payout_kopecks", "contract_number", "contract_signed_at",
        "contract_payment_details", "contract_version"
      ) VALUES ($1, $2, $3, $4, $5, 'ART-2026-001', '2026-09-01',
        'Bank account 123', 1)
    `,
    [id, userId, applicationId, status, minimumPayoutKopecks],
  );
}

describe("affiliate partners migration", () => {
  it("extends roles and enforces partner profile relationships and payout bounds", async () => {
    const db = await createDatabase();

    try {
      const roles = await db.query<{ role: string }>(`
        SELECT "enumlabel" AS "role"
        FROM "pg_enum"
        WHERE "enumtypid" = 'user_role'::regtype
        ORDER BY "enumsortorder"
      `);
      assert.deepEqual(
        roles.rows.map(({ role }) => role),
        ["customer", "admin", "partner"],
      );
      await db.exec(`
        UPDATE "users"
        SET "roles" = ARRAY['customer', 'partner']::"user_role"[]
        WHERE "id" = 'partner-user-1'
      `);

      await insertPartner(db, {
        id: "affiliate-1",
        userId: "partner-user-1",
        applicationId: "application-1",
        minimumPayoutKopecks: 1n,
      });
      await insertPartner(db, {
        id: "affiliate-2",
        userId: "partner-user-2",
        minimumPayoutKopecks: 9_007_199_254_740_991n,
        status: "suspended",
      });
      await insertPartner(db, {
        id: "affiliate-3",
        userId: "partner-user-3",
      });

      const partners = await db.query<{
        applicationId: string | null;
        contractVersion: number;
        createdAt: Date;
        minimumPayoutKopecks: number | null;
        status: string;
        updatedAt: Date;
      }>(`
        SELECT "partner_application_id" AS "applicationId",
          "minimum_payout_kopecks" AS "minimumPayoutKopecks",
          "status"::text AS "status", "contract_version" AS "contractVersion",
          "created_at" AS "createdAt", "updated_at" AS "updatedAt"
        FROM "affiliate_partners"
        ORDER BY "id"
      `);
      assert.equal(partners.rows[0]?.minimumPayoutKopecks, 1);
      assert.equal(partners.rows[0]?.applicationId, "application-1");
      assert.equal(partners.rows[0]?.status, "active");
      assert.equal(partners.rows[0]?.contractVersion, 1);
      assert.ok(partners.rows[0]?.createdAt);
      assert.ok(partners.rows[0]?.updatedAt);
      assert.equal(
        partners.rows[1]?.minimumPayoutKopecks,
        9_007_199_254_740_991,
      );
      assert.equal(partners.rows[1]?.applicationId, null);
      assert.equal(partners.rows[1]?.status, "suspended");
      assert.equal(partners.rows[2]?.applicationId, null);

      for (const statement of [
        `INSERT INTO "affiliate_partners" ("id", "user_id", "status", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version") VALUES ('duplicate-user', 'partner-user-1', 'active', 'N', '2026-09-01', 'D', 1)`,
        `INSERT INTO "affiliate_partners" ("id", "user_id", "partner_application_id", "status", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version") VALUES ('duplicate-application', 'partner-user-4', 'application-1', 'active', 'N', '2026-09-01', 'D', 1)`,
        `INSERT INTO "affiliate_partners" ("id", "user_id", "status", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version") VALUES ('missing-user', 'missing-user', 'active', 'N', '2026-09-01', 'D', 1)`,
        `INSERT INTO "affiliate_partners" ("id", "user_id", "partner_application_id", "status", "contract_number", "contract_signed_at", "contract_payment_details", "contract_version") VALUES ('missing-application', 'partner-user-4', 'missing-application', 'active', 'N', '2026-09-01', 'D', 1)`,
        `UPDATE "affiliate_partners" SET "minimum_payout_kopecks" = 0 WHERE "id" = 'affiliate-1'`,
        `UPDATE "affiliate_partners" SET "minimum_payout_kopecks" = 9007199254740992 WHERE "id" = 'affiliate-1'`,
      ]) {
        await assert.rejects(db.exec(statement));
      }
    } finally {
      await db.close();
    }
  });

  it("keeps contract revisions unique, append-only and referentially intact", async () => {
    const db = await createDatabase();

    try {
      await insertPartner(db, {
        id: "affiliate-1",
        userId: "partner-user-1",
        applicationId: "application-1",
      });
      await db.exec(`
        INSERT INTO "affiliate_contract_revisions" (
          "id", "partner_id", "version", "number", "signed_at",
          "payment_details", "changed_by_user_id"
        ) VALUES (
          'revision-1', 'affiliate-1', 1, 'ART-2026-001', '2026-09-01',
          'Bank account 123', 'admin-user-1'
        )
      `);

      await assert.rejects(
        db.exec(`
          INSERT INTO "affiliate_contract_revisions" (
            "id", "partner_id", "version", "number", "signed_at",
            "payment_details", "changed_by_user_id"
          ) VALUES (
            'revision-2', 'affiliate-1', 1, 'ART-2026-002', '2026-09-02',
            'Bank account 456', 'admin-user-1'
          )
        `),
      );
      await assert.rejects(
        db.exec(`
          INSERT INTO "affiliate_contract_revisions" (
            "id", "partner_id", "version", "number", "signed_at",
            "payment_details", "changed_by_user_id"
          ) VALUES (
            'revision-3', 'affiliate-1', 2, 'ART-2026-002', '2026-09-02',
            'Bank account 456', 'missing-admin'
          )
        `),
      );
      await assert.rejects(
        db.exec(
          `UPDATE "affiliate_contract_revisions" SET "payment_details" = 'Changed' WHERE "id" = 'revision-1'`,
        ),
        /immutable/,
      );
      await assert.rejects(
        db.exec(
          `DELETE FROM "affiliate_contract_revisions" WHERE "id" = 'revision-1'`,
        ),
        /immutable/,
      );
      await assert.rejects(
        db.exec(`DELETE FROM "users" WHERE "id" = 'admin-user-1'`),
      );
      await assert.rejects(
        db.exec(`DELETE FROM "affiliate_partners" WHERE "id" = 'affiliate-1'`),
      );

      await db.exec(
        `DELETE FROM "partner_applications" WHERE "id" = 'application-1'`,
      );
      const partner = await db.query<{ applicationId: string | null }>(`
        SELECT "partner_application_id" AS "applicationId"
        FROM "affiliate_partners"
        WHERE "id" = 'affiliate-1'
      `);
      assert.equal(partner.rows[0]?.applicationId, null);
    } finally {
      await db.close();
    }
  });
});
