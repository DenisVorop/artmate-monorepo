import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260901150000_add_workshops/migration.sql",
);

describe("Workshops migration", () => {
  it("enforces exact ownership, memberships, attempts and revision pointers", async () => {
    const db = await createDatabase();

    try {
      await seedOfficialData(db);
      const enumValues = await db.query<{ labels: string[]; name: string }>(`
        SELECT t.typname AS "name", array_agg(e.enumlabel ORDER BY e.enumsortorder) AS "labels"
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname LIKE 'workshop_%'
        GROUP BY t.typname
        ORDER BY t.typname
      `);
      assert.deepEqual(enumValues.rows, [
        {
          name: "workshop_collection_source",
          labels: ["manual", "purchase", "activation_code"],
        },
        {
          name: "workshop_moderation_decision",
          labels: ["submitted", "approved", "changes_requested", "hidden"],
        },
        {
          name: "workshop_report_reason",
          labels: [
            "copyright",
            "official_copy",
            "inappropriate",
            "spam",
            "personal_data",
            "other",
          ],
        },
        {
          name: "workshop_report_status",
          labels: ["open", "reviewed", "dismissed", "actioned"],
        },
        {
          name: "workshop_revision_status",
          labels: [
            "draft",
            "pending",
            "approved",
            "changes_requested",
            "hidden",
          ],
        },
        { name: "workshop_tool_type", labels: ["artmate_168", "custom"] },
      ]);
      await db.exec(`
        INSERT INTO "workshops" ("id", "owner_id", "handle")
        VALUES ('${"a".repeat(32)}', 'user-1', '0123456789abcdefabcd');
        INSERT INTO "workshop_collections" ("workshop_id", "collection_id")
        VALUES ('${"a".repeat(32)}', 'collection-1');
        INSERT INTO "workshop_works" (
          "id", "public_id", "workshop_id", "collection_id", "coloring_id"
        ) VALUES (
          '${"b".repeat(32)}', '0123456789abcdef01234567', '${"a".repeat(32)}',
          'collection-1', 'coloring-1'
        );
      `);

      const defaults = await db.query<{
        attempt: number;
        enabled: boolean;
        indexable: boolean;
        publishedAt: Date | null;
        public: boolean;
        sequence: number;
        source: string;
      }>(`
        SELECT w."is_public" AS "public", w."is_indexable" AS "indexable",
          wc."source"::text AS "source", ww."attempt_number" AS "attempt",
          ww."revision_sequence" AS "sequence",
          ww."is_publication_enabled" AS "enabled", ww."published_at" AS "publishedAt"
        FROM "workshops" w
        JOIN "workshop_collections" wc ON wc."workshop_id" = w."id"
        JOIN "workshop_works" ww ON ww."workshop_id" = w."id"
      `);
      assert.deepEqual(defaults.rows[0], {
        attempt: 1,
        enabled: false,
        indexable: false,
        publishedAt: null,
        public: false,
        sequence: 0,
        source: "manual",
      });

      await assert.rejects(
        db.exec(
          `INSERT INTO "workshops" ("id", "owner_id", "handle") VALUES ('${"c".repeat(32)}', 'user-1', 'fedcba9876543210abcd')`,
        ),
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO "workshop_collections" ("workshop_id", "collection_id") VALUES ('${"a".repeat(32)}', 'collection-1')`,
        ),
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO "workshop_works" ("id", "public_id", "workshop_id", "collection_id", "coloring_id") VALUES ('${"c".repeat(32)}', 'fedcba987654321001234567', '${"a".repeat(32)}', 'collection-1', 'coloring-1')`,
        ),
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO "workshop_works" ("id", "public_id", "workshop_id", "collection_id", "coloring_id", "attempt_number") VALUES ('${"c".repeat(32)}', 'fedcba987654321001234567', '${"a".repeat(32)}', 'collection-2', 'coloring-1', 2)`,
        ),
      );

      await insertRevision(db, "d".repeat(32), "b".repeat(32), "coloring-1");
      await db.exec(
        `UPDATE "workshop_works" SET "current_revision_id" = '${"d".repeat(32)}', "published_revision_id" = '${"d".repeat(32)}' WHERE "id" = '${"b".repeat(32)}'`,
      );
      await db.exec(`
        INSERT INTO "workshop_works" ("id", "public_id", "workshop_id", "collection_id", "coloring_id", "attempt_number")
        VALUES ('${"e".repeat(32)}', 'abcdef0123456789abcdef01', '${"a".repeat(32)}', 'collection-1', 'coloring-1', 2)
      `);
      await assert.rejects(
        insertRevision(
          db,
          "9".repeat(32),
          "e".repeat(32),
          "coloring-1",
          "official-revision-2",
        ),
      );
      await insertRevision(db, "f".repeat(32), "e".repeat(32), "coloring-1");
      await assert.rejects(
        db.exec(
          `UPDATE "workshop_works" SET "current_revision_id" = '${"f".repeat(32)}' WHERE "id" = '${"b".repeat(32)}'`,
        ),
      );
    } finally {
      await db.close();
    }
  });

  it("preserves marker strings and permits partial mappings and duplicate numbers", async () => {
    const db = await createDatabase();

    try {
      await seedOfficialData(db);
      await db.exec(`
        INSERT INTO "workshops" ("id", "owner_id", "handle") VALUES ('${"a".repeat(32)}', 'user-1', '0123456789abcdefabcd');
        INSERT INTO "workshop_collections" ("workshop_id", "collection_id") VALUES ('${"a".repeat(32)}', 'collection-1');
        INSERT INTO "workshop_works" ("id", "public_id", "workshop_id", "collection_id", "coloring_id") VALUES ('${"b".repeat(32)}', '0123456789abcdef01234567', '${"a".repeat(32)}', 'collection-1', 'coloring-1');
      `);
      await insertRevision(db, "d".repeat(32), "b".repeat(32), "coloring-1");
      await db.exec(`
        INSERT INTO "revision_materials" (
          "revision_id", "position", "tool_type", "brand", "line"
        ) VALUES ('${"d".repeat(32)}', 1, 'custom', 'Copic', 'Sketch');
        INSERT INTO "revision_symbol_mappings" (
          "revision_id", "symbol", "material_position", "marker_number"
        ) VALUES
          ('${"d".repeat(32)}', '1', 1, '006'),
          ('${"d".repeat(32)}', 'A', 1, '006');
      `);
      const mappings = await db.query<{
        markerNumber: string;
        symbol: string;
      }>(`
        SELECT "symbol", "marker_number" AS "markerNumber"
        FROM "revision_symbol_mappings" ORDER BY "symbol"
      `);

      assert.deepEqual(mappings.rows, [
        { markerNumber: "006", symbol: "1" },
        { markerNumber: "006", symbol: "A" },
      ]);
      await assert.rejects(
        db.exec(
          `INSERT INTO "revision_symbol_mappings" ("revision_id", "symbol", "material_position", "marker_number") VALUES ('${"d".repeat(32)}', 'K', 1, '001')`,
        ),
      );
      await assert.rejects(
        db.exec(
          `UPDATE "workshop_work_revisions" SET "caption" = 'mutable' WHERE "id" = '${"d".repeat(32)}'`,
        ),
      );
      await db.exec(`
        INSERT INTO "workshop_moderation_events" (
          "id", "work_id", "revision_id", "actor_id", "decision"
        ) VALUES (
          '${"e".repeat(32)}', '${"b".repeat(32)}', '${"d".repeat(32)}', 'user-1', 'submitted'
        )
      `);
      await assert.rejects(
        db.exec(
          `UPDATE "workshop_moderation_events" SET "reason" = 'changed' WHERE "id" = '${"e".repeat(32)}'`,
        ),
      );
      await assert.rejects(
        db.exec(
          `DELETE FROM "workshop_moderation_events" WHERE "id" = '${"e".repeat(32)}'`,
        ),
      );
    } finally {
      await db.close();
    }
  });

  it("scopes one reporter uniqueness to an exact published revision", async () => {
    const db = await createDatabase();
    const workId = "b".repeat(32);
    const firstRevisionId = "d".repeat(32);
    const secondRevisionId = "e".repeat(32);

    try {
      await seedOfficialData(db);
      await db.exec(`
        INSERT INTO "workshops" ("id", "owner_id", "handle")
        VALUES ('${"a".repeat(32)}', 'user-1', '0123456789abcdefabcd');
        INSERT INTO "workshop_collections" ("workshop_id", "collection_id")
        VALUES ('${"a".repeat(32)}', 'collection-1');
        INSERT INTO "workshop_works" (
          "id", "public_id", "workshop_id", "collection_id", "coloring_id"
        ) VALUES (
          '${workId}', '0123456789abcdef01234567', '${"a".repeat(32)}',
          'collection-1', 'coloring-1'
        );
      `);
      await insertRevision(
        db,
        firstRevisionId,
        workId,
        "coloring-1",
        "official-revision-1",
        1,
      );
      await insertRevision(
        db,
        secondRevisionId,
        workId,
        "coloring-1",
        "official-revision-1",
        2,
      );
      await db.exec(`
        INSERT INTO "workshop_work_reports" (
          "id", "work_id", "revision_id", "reporter_id", "reason"
        ) VALUES (
          '${"1".repeat(32)}', '${workId}', '${firstRevisionId}', 'user-2', 'copyright'
        );
      `);

      await assert.rejects(
        db.exec(`
          INSERT INTO "workshop_work_reports" (
            "id", "work_id", "revision_id", "reporter_id", "reason"
          ) VALUES (
            '${"2".repeat(32)}', '${workId}', '${firstRevisionId}', 'user-2', 'spam'
          );
        `),
      );
      await db.exec(`
        INSERT INTO "workshop_work_reports" (
          "id", "work_id", "revision_id", "reporter_id", "reason"
        ) VALUES (
          '${"3".repeat(32)}', '${workId}', '${secondRevisionId}', 'user-2', 'spam'
        );
      `);
      const reports = await db.query<{ revisionId: string }>(`
        SELECT "revision_id" AS "revisionId"
        FROM "workshop_work_reports"
        WHERE "reporter_id" = 'user-2'
        ORDER BY "revision_id"
      `);

      assert.deepEqual(reports.rows, [
        { revisionId: firstRevisionId },
        { revisionId: secondRevisionId },
      ]);
    } finally {
      await db.close();
    }
  });
});

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TYPE "user_status" AS ENUM ('active', 'blocked', 'deleted');
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "marker_colors" ("id" VARCHAR(32) PRIMARY KEY);
    CREATE TABLE "coloring_collections" ("id" VARCHAR(32) PRIMARY KEY);
    CREATE TABLE "colorings" (
      "id" VARCHAR(32) PRIMARY KEY,
      "collection_id" VARCHAR(32) NOT NULL
    );
    CREATE TABLE "coloring_revisions" (
      "id" VARCHAR(32) PRIMARY KEY,
      "coloring_id" VARCHAR(32) NOT NULL,
      UNIQUE ("coloring_id", "id")
    );
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

async function seedOfficialData(db: PGlite) {
  await db.exec(`
    INSERT INTO "users" ("id") VALUES ('user-1'), ('user-2');
    INSERT INTO "coloring_collections" ("id") VALUES ('collection-1'), ('collection-2');
    INSERT INTO "colorings" ("id", "collection_id") VALUES ('coloring-1', 'collection-1'), ('coloring-2', 'collection-2');
    INSERT INTO "coloring_revisions" ("id", "coloring_id") VALUES ('official-revision-1', 'coloring-1'), ('official-revision-2', 'coloring-2');
  `);
}

async function insertRevision(
  db: PGlite,
  revisionId: string,
  workId: string,
  coloringId: string,
  officialRevisionId = "official-revision-1",
  sequence = 1,
) {
  const checksum = "1".repeat(64);
  const source = "2".repeat(64);
  await db.exec(`
    INSERT INTO "workshop_work_revisions" (
      "id", "work_id", "coloring_id", "sequence", "official_revision_id",
      "status", "crop_rotation", "crop_zoom", "crop_x", "crop_y",
      "source_mime", "source_checksum", "normalized_storage_key",
      "normalized_checksum", "normalized_byte_size", "normalized_width", "normalized_height",
      "web_storage_key", "web_checksum", "web_byte_size", "web_width", "web_height",
      "thumb_storage_key", "thumb_checksum", "thumb_byte_size", "thumb_width", "thumb_height"
    ) VALUES (
      '${revisionId}', '${workId}', '${coloringId}', ${sequence}, '${officialRevisionId}',
      'draft', 0, 1, 0, 0, 'image/jpeg', '${source}',
      '${workId}/${revisionId}/normalized-${checksum}.webp', '${checksum}', 10, 800, 1000,
      '${workId}/${revisionId}/web-${checksum}.webp', '${checksum}', 10, 800, 1000,
      '${workId}/${revisionId}/thumb-${checksum}.webp', '${checksum}', 10, 320, 400
    )
  `);
}
