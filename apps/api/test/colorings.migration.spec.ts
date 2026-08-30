import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260828120000_add_colorings/migration.sql",
);
const revisionMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260828160000_add_coloring_revisions/migration.sql",
);
const publicationTimestampMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260829120000_add_coloring_revision_first_published_at/migration.sql",
);

describe("Colorings migration constraints", () => {
  it("keeps media revisions in a separate second migration", async () => {
    const migration = await readFile(revisionMigrationPath, "utf8").catch(
      () => undefined,
    );

    assert.equal(typeof migration, "string");
  });

  it("backfills first publication only for the composite current revision pointer", async () => {
    const db = new PGlite();
    const oldRevisionId = "a".repeat(32);
    const currentRevisionId = "b".repeat(32);
    const rollingRevisionId = "c".repeat(32);
    const publishedAt = "2026-08-29T09:30:00.123Z";
    const rollingPublishedAt = "2026-08-29T09:45:00.456Z";

    try {
      await db.exec(`
        CREATE TYPE "product_status" AS ENUM ('draft', 'published', 'archived');
        CREATE TYPE "product_tag_group" AS ENUM (
          'format', 'theme', 'audience', 'mood', 'difficulty'
        );
        CREATE TABLE "users" (
          "id" TEXT PRIMARY KEY
        );
        CREATE TABLE "products" (
          "id" VARCHAR(32) PRIMARY KEY,
          "status" "product_status" NOT NULL DEFAULT 'draft'
        );
        CREATE TABLE "product_tags" (
          "id" VARCHAR(32) PRIMARY KEY,
          "group" "product_tag_group" NOT NULL
        );
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(await readFile(revisionMigrationPath, "utf8"));
      await db.exec(`
        INSERT INTO "users" ("id") VALUES ('admin-1');
        INSERT INTO "products" ("id", "status")
          VALUES ('product-1', 'published');
        INSERT INTO "colorings"
          ("id", "product_id", "slug", "title", "description", "position")
          VALUES
            ('coloring-1', 'product-1', 'forest', 'Forest', 'Description', 0);
      `);
      await insertRevision(db, "coloring-1", oldRevisionId, 1, "1");
      await insertRevision(db, "coloring-1", currentRevisionId, 2, "2");
      await db.exec(`
        UPDATE "colorings"
        SET "status" = 'published',
            "revision_sequence" = 2,
            "published_revision_id" = '${currentRevisionId}',
            "published_at" = '${publishedAt}',
            "published_by_id" = 'admin-1'
        WHERE "id" = 'coloring-1'
      `);

      await db.exec(await readFile(publicationTimestampMigrationPath, "utf8"));
      await insertRevision(db, "coloring-1", rollingRevisionId, 3, "3");
      await db.exec(`
        UPDATE "colorings"
        SET "revision_sequence" = 3,
            "published_revision_id" = '${rollingRevisionId}',
            "published_at" = '${rollingPublishedAt}'
        WHERE "id" = 'coloring-1'
      `);
      const revisions = await db.query<{
        firstPublishedAt: string | null;
        id: string;
      }>(`
        SELECT
          "id",
          "first_published_at"::text AS "firstPublishedAt"
        FROM "coloring_revisions"
        ORDER BY "version"
      `);

      assert.deepEqual(revisions.rows, [
        { id: oldRevisionId, firstPublishedAt: null },
        {
          id: currentRevisionId,
          firstPublishedAt: "2026-08-29 09:30:00.123",
        },
        {
          id: rollingRevisionId,
          firstPublishedAt: "2026-08-29 09:45:00.456",
        },
      ]);
    } finally {
      await db.close();
    }
  });

  it("enforces theme assignments, parent restrictions, uniqueness and cascade cleanup", async () => {
    const db = new PGlite();

    try {
      await db.exec(`
        CREATE TYPE "product_tag_group" AS ENUM (
          'format', 'theme', 'audience', 'mood', 'difficulty'
        );
        CREATE TABLE "products" (
          "id" VARCHAR(32) PRIMARY KEY
        );
        CREATE TABLE "product_tags" (
          "id" VARCHAR(32) PRIMARY KEY,
          "group" "product_tag_group" NOT NULL
        );
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(`
        INSERT INTO "products" ("id") VALUES ('product-1');
        INSERT INTO "product_tags" ("id", "group") VALUES
          ('theme-forest', 'theme'),
          ('format-a4', 'format');
        INSERT INTO "colorings"
          ("id", "product_id", "slug", "title", "position")
          VALUES ('coloring-1', 'product-1', 'forest', 'Forest', 0);
        INSERT INTO "coloring_theme_assignments" ("coloring_id", "tag_id")
          VALUES ('coloring-1', 'theme-forest');
      `);

      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_theme_assignments" ("coloring_id", "tag_id")
         VALUES ('coloring-1', 'format-a4')`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_theme_assignments"
           ("coloring_id", "tag_id", "tag_group")
         VALUES ('coloring-1', 'format-a4', 'format')`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "product_tags"
         SET "group" = 'mood'
         WHERE "id" = 'theme-forest'`,
      );
      await rejectsConstraint(
        db,
        `DELETE FROM "product_tags" WHERE "id" = 'theme-forest'`,
      );
      await rejectsConstraint(
        db,
        `DELETE FROM "products" WHERE "id" = 'product-1'`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "colorings"
           ("id", "product_id", "slug", "title", "position")
         VALUES ('coloring-negative', 'product-1', 'negative', 'Negative', -1)`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "colorings"
           ("id", "product_id", "slug", "title", "position")
         VALUES ('coloring-slug', 'product-1', 'forest', 'Duplicate slug', 1)`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "colorings"
           ("id", "product_id", "slug", "title", "position")
         VALUES ('coloring-position', 'product-1', 'position', 'Duplicate position', 0)`,
      );

      await db.exec(`DELETE FROM "colorings" WHERE "id" = 'coloring-1'`);
      const assignments = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS "count"
         FROM "coloring_theme_assignments"`,
      );

      assert.equal(assignments.rows[0]?.count, 0);
      await db.exec(`DELETE FROM "product_tags" WHERE "id" = 'theme-forest'`);
      await db.exec(`DELETE FROM "products" WHERE "id" = 'product-1'`);
    } finally {
      await db.close();
    }
  });

  it("enforces immutable revisions, reviews and same-coloring publication pointers", async () => {
    const db = new PGlite();

    try {
      await db.exec(`
        CREATE TYPE "product_status" AS ENUM ('draft', 'published', 'archived');
        CREATE TYPE "product_tag_group" AS ENUM (
          'format', 'theme', 'audience', 'mood', 'difficulty'
        );
        CREATE TABLE "users" (
          "id" TEXT PRIMARY KEY
        );
        CREATE TABLE "products" (
          "id" VARCHAR(32) PRIMARY KEY,
          "status" "product_status" NOT NULL DEFAULT 'draft'
        );
        CREATE TABLE "product_tags" (
          "id" VARCHAR(32) PRIMARY KEY,
          "group" "product_tag_group" NOT NULL
        );
      `);
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec(await readFile(revisionMigrationPath, "utf8"));
      const constraints = await db.query<{ name: string }>(`
        SELECT "conname" AS "name"
        FROM "pg_constraint"
        WHERE "conrelid" IN (
          'colorings'::regclass,
          'coloring_revisions'::regclass,
          'coloring_revision_reviews'::regclass
        )
      `);
      const constraintNames = new Set(constraints.rows.map(({ name }) => name));

      for (const name of [
        "colorings_revision_sequence_check",
        "colorings_publication_state_check",
        "colorings_publisher_state_check",
        "coloring_revisions_id_check",
        "coloring_revisions_version_check",
        "coloring_revisions_metadata_check",
        "coloring_revisions_used_color_count_check",
        "coloring_revisions_dimensions_check",
        "coloring_revisions_profile_check",
        "coloring_revisions_source_mime_check",
        "coloring_revisions_byte_size_check",
        "coloring_revisions_checksum_check",
        "coloring_revisions_storage_key_check",
        "coloring_revision_reviews_comment_check",
        "coloring_revision_reviews_rejected_comment_check",
        "coloring_revisions_coloring_id_fkey",
        "coloring_revisions_created_by_id_fkey",
        "coloring_revision_reviews_revision_id_fkey",
        "coloring_revision_reviews_reviewed_by_id_fkey",
        "colorings_published_by_id_fkey",
        "colorings_published_revision_fkey",
      ]) {
        assert.equal(constraintNames.has(name), true, `missing ${name}`);
      }

      const indexes = await db.query<{ name: string }>(`
        SELECT "indexname" AS "name"
        FROM "pg_indexes"
        WHERE "tablename" IN ('colorings', 'coloring_revisions')
      `);
      const indexNames = new Set(indexes.rows.map(({ name }) => name));

      for (const name of [
        "colorings_published_revision_id_key",
        "colorings_id_published_revision_id_key",
        "coloring_revisions_coloring_id_version_key",
        "coloring_revisions_coloring_id_id_key",
        "coloring_revisions_outline_storage_key_key",
        "coloring_revisions_colored_storage_key_key",
      ]) {
        assert.equal(indexNames.has(name), true, `missing ${name}`);
      }
      await db.exec(`
        INSERT INTO "users" ("id") VALUES ('admin-1');
        INSERT INTO "products" ("id", "status")
          VALUES ('product-1', 'published');
        INSERT INTO "product_tags" ("id", "group")
          VALUES ('theme-forest', 'theme');
        INSERT INTO "colorings"
          ("id", "product_id", "slug", "title", "description", "position")
          VALUES
            ('coloring-1', 'product-1', 'forest', 'Forest', 'Description', 0),
            ('coloring-2', 'product-1', 'ocean', 'Ocean', 'Description', 1);
        INSERT INTO "coloring_theme_assignments" ("coloring_id", "tag_id")
          VALUES
            ('coloring-1', 'theme-forest'),
            ('coloring-2', 'theme-forest');
      `);

      await insertRevision(db, "coloring-1", "a".repeat(32), 1, "1");
      await insertRevision(db, "coloring-2", "b".repeat(32), 1, "2");
      await db.exec(`
        INSERT INTO "colorings"
          ("id", "product_id", "slug", "title", "description", "position")
        VALUES
          ('unsafe/../id', 'product-1', 'unsafe-path', 'Unsafe', 'Description', 2)
      `);

      await rejectsConstraint(
        db,
        `UPDATE "colorings"
         SET "revision_sequence" = -1
         WHERE "id" = 'coloring-1'`,
      );
      await rejectsConstraint(
        db,
        revisionInsertSql("coloring-1", "c".repeat(32), 2, "3", {
          usedColorCount: 169,
        }),
      );
      for (const sql of [
        revisionInsertSql("coloring-1", "invalid-id", 2, "0"),
        revisionInsertSql("coloring-1", "1".repeat(32), 0, "1"),
        revisionInsertSql("coloring-1", "2".repeat(32), 2, "2", {
          paletteLabel: "   ",
        }),
        revisionInsertSql("coloring-1", "3".repeat(32), 2, "3", {
          width: 1601,
        }),
        revisionInsertSql("coloring-1", "4".repeat(32), 2, "4", {
          outlineByteSize: 0,
        }),
        revisionInsertSql("coloring-1", "5".repeat(32), 2, "5", {
          outlineSourceMime: "image/jpeg",
        }),
        revisionInsertSql("coloring-1", "6".repeat(32), 2, "6", {
          outlineSourceChecksum: "A".repeat(64),
        }),
        revisionInsertSql("coloring-1", "7".repeat(32), 2, "7", {
          derivativeProfile: "unsafe-profile",
        }),
        revisionInsertSql("coloring-1", "8".repeat(32), 2, "8", {
          colorSpace: "cmyk",
        }),
        revisionInsertSql("coloring-1", "9".repeat(32), 1, "9"),
        revisionInsertSql("missing", "0".repeat(32), 1, "0"),
        revisionInsertSql("unsafe/../id", "0".repeat(32), 1, "0"),
        revisionInsertSql("coloring-1", "c".repeat(32), 2, "c", {
          createdById: "missing-user",
        }),
      ]) {
        await rejectsConstraint(db, sql);
      }
      await rejectsConstraint(
        db,
        revisionInsertSql("coloring-1", "d".repeat(32), 2, "4", {
          coloredChecksum: "4".repeat(64),
          outlineChecksum: "4".repeat(64),
        }),
      );
      await rejectsConstraint(
        db,
        revisionInsertSql("coloring-1", "e".repeat(32), 2, "5", {
          outlineStorageKey: "../outline.webp",
        }),
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_revision_reviews"
           ("revision_id", "decision", "comment", "reviewed_by_id")
         VALUES ('${"a".repeat(32)}', 'rejected', '   ', 'admin-1')`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_revision_reviews"
           ("revision_id", "decision")
         VALUES ('${"b".repeat(32)}', 'rejected')`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_revision_reviews"
           ("revision_id", "decision", "reviewed_by_id")
         VALUES ('${"b".repeat(32)}', 'approved', 'missing-user')`,
      );

      await db.exec(`
        INSERT INTO "coloring_revision_reviews"
          ("revision_id", "decision", "reviewed_by_id")
        VALUES ('${"a".repeat(32)}', 'approved', 'admin-1')
      `);
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_revision_reviews"
           ("revision_id", "decision")
         VALUES ('${"a".repeat(32)}', 'approved')`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "colorings"
         SET "status" = 'published',
             "published_revision_id" = '${"b".repeat(32)}',
             "published_at" = CURRENT_TIMESTAMP,
             "published_by_id" = 'admin-1'
         WHERE "id" = 'coloring-1'`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "colorings"
         SET "status" = 'published',
             "published_revision_id" = '${"b".repeat(32)}',
             "published_at" = CURRENT_TIMESTAMP,
             "published_by_id" = 'missing-user'
         WHERE "id" = 'coloring-2'`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "colorings"
         SET "status" = 'published'
         WHERE "id" = 'coloring-2'`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "colorings"
         SET "published_by_id" = 'missing-user'
         WHERE "id" = 'coloring-1'`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "coloring_revision_reviews"
           ("revision_id", "decision")
         VALUES ('${"f".repeat(32)}', 'approved')`,
      );

      await db.exec(`
        UPDATE "colorings"
        SET "status" = 'published',
            "revision_sequence" = 1,
            "published_revision_id" = '${"a".repeat(32)}',
            "published_at" = CURRENT_TIMESTAMP,
            "published_by_id" = 'admin-1'
        WHERE "id" = 'coloring-1'
      `);
      await rejectsConstraint(
        db,
        `DELETE FROM "coloring_revisions" WHERE "id" = '${"a".repeat(32)}'`,
      );

      await db.exec(`DELETE FROM "users" WHERE "id" = 'admin-1'`);
      const provenance = await db.query<{
        createdById: string | null;
        publishedById: string | null;
        reviewedById: string | null;
      }>(`
        SELECT
          r."created_by_id" AS "createdById",
          c."published_by_id" AS "publishedById",
          v."reviewed_by_id" AS "reviewedById"
        FROM "colorings" c
        JOIN "coloring_revisions" r ON r."id" = c."published_revision_id"
        JOIN "coloring_revision_reviews" v ON v."revision_id" = r."id"
        WHERE c."id" = 'coloring-1'
      `);

      assert.deepEqual(provenance.rows[0], {
        createdById: null,
        publishedById: null,
        reviewedById: null,
      });
      await db.exec(`DELETE FROM "colorings" WHERE "id" = 'coloring-1'`);
      const revisions = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS "count"
        FROM "coloring_revisions"
        WHERE "coloring_id" = 'coloring-1'
      `);

      assert.equal(revisions.rows[0]?.count, 0);
      const reviews = await db.query<{ count: number }>(`
        SELECT COUNT(*)::int AS "count"
        FROM "coloring_revision_reviews"
        WHERE "revision_id" = '${"a".repeat(32)}'
      `);

      assert.equal(reviews.rows[0]?.count, 0);
    } finally {
      await db.close();
    }
  });
});

async function rejectsConstraint(db: PGlite, sql: string) {
  await assert.rejects(db.exec(sql), (error: unknown) => {
    assert.match(String(error), /constraint|violates|duplicate/i);

    return true;
  });
}

async function insertRevision(
  db: PGlite,
  coloringId: string,
  revisionId: string,
  version: number,
  checksumSeed: string,
) {
  await db.exec(
    revisionInsertSql(coloringId, revisionId, version, checksumSeed),
  );
}

function revisionInsertSql(
  coloringId: string,
  revisionId: string,
  version: number,
  checksumSeed: string,
  overrides: {
    coloredChecksum?: string;
    colorSpace?: string;
    createdById?: string;
    derivativeProfile?: string;
    outlineByteSize?: number;
    outlineChecksum?: string;
    outlineSourceChecksum?: string;
    outlineSourceMime?: string;
    outlineStorageKey?: string;
    paletteLabel?: string;
    usedColorCount?: number;
    width?: number;
  } = {},
) {
  const outlineChecksum = overrides.outlineChecksum ?? checksumSeed.repeat(64);
  const coloredDigit = checksumSeed === "f" ? "e" : "f";
  const coloredChecksum = overrides.coloredChecksum ?? coloredDigit.repeat(64);
  const outlineStorageKey =
    overrides.outlineStorageKey ??
    `${coloringId}/${revisionId}/outline-${outlineChecksum}.webp`;
  const coloredStorageKey = `${coloringId}/${revisionId}/colored-${coloredChecksum}.webp`;

  return `
    INSERT INTO "coloring_revisions" (
      "id", "coloring_id", "version", "palette_label", "palette_version",
      "used_color_count", "width", "height", "derivative_profile", "color_space",
      "outline_source_mime", "outline_source_checksum", "outline_storage_key",
      "outline_byte_size", "outline_checksum", "outline_alt",
      "colored_source_mime", "colored_source_checksum", "colored_storage_key",
      "colored_byte_size", "colored_checksum", "colored_alt", "created_by_id"
    ) VALUES (
      '${revisionId}', '${coloringId}', ${version}, '${overrides.paletteLabel ?? "Artmate 168"}', '2026-08',
      ${overrides.usedColorCount ?? 12}, ${overrides.width ?? 1200}, 1600, '${overrides.derivativeProfile ?? "webp-preview-v1"}', '${overrides.colorSpace ?? "srgb"}',
      '${overrides.outlineSourceMime ?? "image/png"}', '${overrides.outlineSourceChecksum ?? "a".repeat(64)}', '${outlineStorageKey}',
      ${overrides.outlineByteSize ?? 1024}, '${outlineChecksum}', 'Контур',
      'image/webp', '${"b".repeat(64)}', '${coloredStorageKey}',
      2048, '${coloredChecksum}', 'Цветная версия', '${overrides.createdById ?? "admin-1"}'
    )
  `;
}
