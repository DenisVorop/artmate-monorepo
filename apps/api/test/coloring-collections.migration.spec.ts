import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const coloringMigrationPath = resolve(
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
const collectionMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260829160000_add_coloring_collections/migration.sql",
);
const cardStorageHardeningMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260829170000_harden_coloring_card_storage/migration.sql",
);
const coloringNumberMigrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260829180000_add_coloring_numbers/migration.sql",
);

describe("Coloring collections migration", () => {
  it("backfills Product -> ColoringCollection -> Coloring without inventing a cover", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(await readFile(collectionMigrationPath, "utf8"));
      await db.exec(
        await readFile(cardStorageHardeningMigrationPath, "utf8"),
      );
      await db.exec(await readFile(coloringNumberMigrationPath, "utf8"));

      const collections = await db.query<{
        coverAlt: string | null;
        coverHeight: number | null;
        coverUrl: string | null;
        coverWidth: number | null;
        description: string | null;
        expectedColoringCount: number;
        id: string;
        position: number;
        productId: string;
        publishedAt: string | null;
        slug: string;
        status: string;
        title: string;
      }>(`
        SELECT
          "id",
          "product_id" AS "productId",
          "slug",
          "title",
          "description",
          "position",
          "expected_coloring_count" AS "expectedColoringCount",
          "status"::text AS "status",
          "cover_url" AS "coverUrl",
          "cover_alt" AS "coverAlt",
          "cover_width" AS "coverWidth",
          "cover_height" AS "coverHeight",
          "published_at"::text AS "publishedAt"
        FROM "coloring_collections"
        ORDER BY "position"
      `);

      assert.deepEqual(collections.rows, [
        {
          coverAlt: null,
          coverHeight: null,
          coverUrl: null,
          coverWidth: null,
          description: "Twenty-five mysterious forest pictures",
          expectedColoringCount: 25,
          id: "product-forest",
          position: 0,
          productId: "product-forest",
          publishedAt: "2026-08-02 10:00:00.123",
          slug: "mysterious-forest",
          status: "published",
          title: "Mysterious forest",
        },
        {
          coverAlt: null,
          coverHeight: null,
          coverUrl: null,
          coverWidth: null,
          description: "Twenty-five ocean pictures",
          expectedColoringCount: 25,
          id: "product-ocean",
          position: 1,
          productId: "product-ocean",
          publishedAt: null,
          slug: "ocean-life",
          status: "draft",
          title: "Ocean life",
        },
      ]);

      const colorings = await db.query<{
        collectionId: string;
        id: string;
        legacySlug: string | null;
        number: number;
        position: number;
      }>(`
        SELECT
          "id",
          "collection_id" AS "collectionId",
          "slug" AS "legacySlug",
          "number",
          "position"
        FROM "colorings"
        ORDER BY "id"
      `);

      assert.deepEqual(colorings.rows, [
        {
          collectionId: "product-forest",
          id: "coloring-forest-1",
          legacySlug: "forest-1",
          number: 1,
          position: 0,
        },
        {
          collectionId: "product-forest",
          id: "coloring-forest-2",
          legacySlug: "forest-2",
          number: 2,
          position: 1,
        },
        {
          collectionId: "product-ocean",
          id: "coloring-ocean-1",
          legacySlug: "ocean-1",
          number: 1,
          position: 0,
        },
      ]);

      const productIdColumn = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM information_schema.columns
        WHERE table_name = 'colorings'
          AND column_name = 'product_id'
      `);
      const collectionIdColumn = await db.query<{
        isNullable: string;
      }>(`
        SELECT is_nullable AS "isNullable"
        FROM information_schema.columns
        WHERE table_name = 'colorings'
          AND column_name = 'collection_id'
      `);
      const slugColumn = await db.query<{ isNullable: string }>(`
        SELECT is_nullable AS "isNullable"
        FROM information_schema.columns
        WHERE table_name = 'colorings'
          AND column_name = 'slug'
      `);
      const emptyProductCollection = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM "coloring_collections"
        WHERE "product_id" = 'product-without-colorings'
      `);
      const productImages = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM "product_images"
        WHERE "product_id" = 'product-forest'
      `);
      const legacyCards = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM "coloring_revisions"
        WHERE "card_storage_key" IS NULL
          AND "card_byte_size" IS NULL
          AND "card_checksum" IS NULL
          AND "card_width" IS NULL
          AND "card_height" IS NULL
      `);

      assert.equal(productIdColumn.rows[0]?.count, 0);
      assert.equal(collectionIdColumn.rows[0]?.isNullable, "NO");
      assert.equal(slugColumn.rows[0]?.isNullable, "YES");
      assert.equal(emptyProductCollection.rows[0]?.count, 0);
      assert.equal(productImages.rows[0]?.count, 2);
      assert.equal(legacyCards.rows[0]?.count, 2);
    } finally {
      await db.close();
    }
  });

  it("enforces one-to-one ownership, ordering, lifecycle, cover and card invariants", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(await readFile(collectionMigrationPath, "utf8"));
      await db.exec(
        await readFile(cardStorageHardeningMigrationPath, "utf8"),
      );
      await db.exec(await readFile(coloringNumberMigrationPath, "utf8"));
      await db.exec(`
        INSERT INTO "products" (
          "id", "slug", "title", "description", "status", "price",
          "created_at", "updated_at"
        ) VALUES (
          'product-space', 'space-album', 'Space album', NULL, 'published',
          129000, '2026-08-04T10:00:00.000Z', '2026-08-04T10:00:00.000Z'
        )
      `);

      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "duplicate-product",
          productId: "product-forest",
          slug: "second-forest",
          title: "Second forest",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "negative-position",
          position: -1,
          productId: "product-space",
          slug: "negative-position",
          title: "Negative position",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          expectedColoringCount: 0,
          id: "zero-count",
          productId: "product-space",
          slug: "zero-count",
          title: "Zero count",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          expectedColoringCount: 100,
          id: "too-many",
          productId: "product-space",
          slug: "too-many",
          title: "Too many",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "padded-slug",
          productId: "product-space",
          slug: " padded-slug ",
          title: "Padded slug",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "blank-title",
          productId: "product-space",
          slug: "blank-title",
          title: "   ",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "published-without-time",
          productId: "product-space",
          slug: "published-without-time",
          status: "published",
          title: "Published without time",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          id: "draft-with-time",
          productId: "product-space",
          publishedAt: "2026-08-05T10:00:00.000Z",
          slug: "draft-with-time",
          title: "Draft with time",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          coverUrl: "/media/space.webp",
          id: "partial-cover",
          productId: "product-space",
          slug: "partial-cover",
          title: "Partial cover",
        }),
      );
      await rejectsConstraint(
        db,
        collectionInsertSql({
          coverAlt: "Space cover",
          coverHeight: 0,
          coverUrl: "/media/space.webp",
          coverWidth: 1200,
          id: "invalid-cover-size",
          productId: "product-space",
          slug: "invalid-cover-size",
          title: "Invalid cover size",
        }),
      );

      await db.exec(
        collectionInsertSql({
          coverAlt: "Space cover",
          coverHeight: 1600,
          coverUrl: "/media/space.webp",
          coverWidth: 1200,
          id: "collection-space",
          productId: "product-space",
          slug: "space",
          title: "Space",
        }),
      );
      await db.exec(`
        INSERT INTO "colorings" (
          "id", "collection_id", "slug", "number", "title", "position"
        ) VALUES (
          'coloring-space-1', 'collection-space', NULL, 1, 'Space 1', 0
        )
      `);

      await rejectsConstraint(
        db,
        `INSERT INTO "colorings" (
           "id", "collection_id", "slug", "number", "title", "position"
         ) VALUES (
           'coloring-space-duplicate', 'collection-space',
           'space-duplicate', 2, 'Space duplicate', 0
         )`,
      );
      await rejectsConstraint(
        db,
        `INSERT INTO "colorings" (
           "id", "collection_id", "slug", "number", "title", "position"
         ) VALUES (
           'coloring-space-duplicate-number', 'collection-space',
           'space-duplicate-number', 1, 'Space duplicate number', 1
         )`,
      );
      for (const number of [0, 100]) {
        await rejectsConstraint(
          db,
          `INSERT INTO "colorings" (
             "id", "collection_id", "slug", "number", "title", "position"
           ) VALUES (
             'coloring-space-number-${number}', 'collection-space',
             'space-number-${number}', ${number}, 'Space number ${number}',
             ${number + 1}
           )`,
        );
      }
      await rejectsConstraint(
        db,
        `INSERT INTO "colorings" (
           "id", "collection_id", "slug", "number", "title", "position"
         ) VALUES (
           'coloring-without-collection', 'missing-collection',
           'missing-collection', 2, 'Missing collection', 1
         )`,
      );
      await rejectsConstraint(
        db,
        `DELETE FROM "products" WHERE "id" = 'product-space'`,
      );
      await rejectsConstraint(
        db,
        `DELETE FROM "coloring_collections" WHERE "id" = 'collection-space'`,
      );

      await rejectsConstraint(
        db,
        `UPDATE "coloring_revisions"
         SET "card_storage_key" = 'card-only.webp'
         WHERE "id" = '${"a".repeat(32)}'`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "coloring_revisions"
         SET "card_storage_key" = 'card.webp',
             "card_byte_size" = 0,
             "card_checksum" = '${"c".repeat(64)}',
             "card_width" = 480,
             "card_height" = 640
         WHERE "id" = '${"a".repeat(32)}'`,
      );
      await rejectsConstraint(
        db,
        `UPDATE "coloring_revisions"
         SET "card_storage_key" = 'card.webp',
             "card_byte_size" = 4096,
             "card_checksum" = '${"C".repeat(64)}',
             "card_width" = 480,
             "card_height" = 640
         WHERE "id" = '${"a".repeat(32)}'`,
      );
      await db.exec(`
        UPDATE "coloring_revisions"
        SET "card_storage_key" = 'coloring-forest-1/${"a".repeat(32)}/card-${"c".repeat(64)}.webp',
            "card_byte_size" = 4096,
            "card_checksum" = '${"c".repeat(64)}',
            "card_width" = 480,
            "card_height" = 640
        WHERE "id" = '${"a".repeat(32)}'
      `);
      await db.exec(`
        UPDATE "coloring_collections"
        SET "status" = 'published',
            "published_at" = '2026-08-06T10:00:00.000Z'
        WHERE "id" = 'collection-space'
      `);
      await rejectsConstraint(
        db,
        `UPDATE "coloring_collections"
         SET "status" = 'archived'
         WHERE "id" = 'collection-space'`,
      );
      await db.exec(`
        UPDATE "coloring_collections"
        SET "status" = 'archived', "published_at" = NULL
        WHERE "id" = 'collection-space'
      `);

      const card = await db.query<{
        byteSize: number;
        checksum: string;
        height: number;
        storageKey: string;
        width: number;
      }>(`
        SELECT
          "card_storage_key" AS "storageKey",
          "card_byte_size" AS "byteSize",
          "card_checksum" AS "checksum",
          "card_width" AS "width",
          "card_height" AS "height"
        FROM "coloring_revisions"
        WHERE "id" = '${"a".repeat(32)}'
      `);

      assert.deepEqual(card.rows[0], {
        byteSize: 4096,
        checksum: "c".repeat(64),
        height: 640,
        storageKey: `coloring-forest-1/${"a".repeat(32)}/card-${"c".repeat(64)}.webp`,
        width: 480,
      });
    } finally {
      await db.close();
    }
  });

  it("fails number backfill before schema changes when expected count exceeds 99", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(await readFile(collectionMigrationPath, "utf8"));
      await db.exec(
        await readFile(cardStorageHardeningMigrationPath, "utf8"),
      );
      await db.exec(`
        UPDATE "coloring_collections"
        SET "expected_coloring_count" = 100
        WHERE "id" = 'product-ocean'
      `);

      await assert.rejects(
        db.exec(await readFile(coloringNumberMigrationPath, "utf8")),
        /expected count exceeds the supported maximum of 99/i,
      );

      const numberColumn = await db.query<{ count: number }>(`
        SELECT count(*)::int AS "count"
        FROM information_schema.columns
        WHERE table_name = 'colorings'
          AND column_name = 'number'
      `);
      assert.equal(numberColumn.rows[0]?.count, 0);
    } finally {
      await db.close();
    }
  });

  it("fails number backfill when a collection already exceeds its expected count", async () => {
    const db = await createLegacyDatabase();

    try {
      await db.exec(await readFile(collectionMigrationPath, "utf8"));
      await db.exec(
        await readFile(cardStorageHardeningMigrationPath, "utf8"),
      );
      await db.exec(`
        UPDATE "coloring_collections"
        SET "expected_coloring_count" = 1
        WHERE "id" = 'product-forest'
      `);

      await assert.rejects(
        db.exec(await readFile(coloringNumberMigrationPath, "utf8")),
        /contains more colorings than its supported expected count/i,
      );
    } finally {
      await db.close();
    }
  });
});

async function createLegacyDatabase() {
  const db = new PGlite();

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
      "slug" VARCHAR(180) NOT NULL UNIQUE,
      "title" VARCHAR(220) NOT NULL,
      "description" TEXT,
      "status" "product_status" NOT NULL DEFAULT 'draft',
      "price" INTEGER NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "product_images" (
      "id" VARCHAR(32) PRIMARY KEY,
      "product_id" VARCHAR(32) NOT NULL REFERENCES "products"("id")
        ON DELETE CASCADE,
      "url" TEXT NOT NULL,
      "alt" VARCHAR(220),
      "sort_order" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "product_tags" (
      "id" VARCHAR(32) PRIMARY KEY,
      "group" "product_tag_group" NOT NULL
    );
  `);
  await db.exec(await readFile(coloringMigrationPath, "utf8"));
  await db.exec(await readFile(revisionMigrationPath, "utf8"));
  await db.exec(await readFile(publicationTimestampMigrationPath, "utf8"));
  await db.exec(`
    INSERT INTO "products" (
      "id", "slug", "title", "description", "status", "price",
      "created_at", "updated_at"
    ) VALUES
      (
        'product-forest', 'mysterious-forest', 'Mysterious forest',
        'Twenty-five mysterious forest pictures', 'published', 129000,
        '2026-08-01T10:00:00.000Z', '2026-08-03T10:00:00.000Z'
      ),
      (
        'product-ocean', 'ocean-life', 'Ocean life',
        'Twenty-five ocean pictures', 'published', 129000,
        '2026-08-02T10:00:00.000Z', '2026-08-03T10:00:00.000Z'
      ),
      (
        'product-without-colorings', 'paper-only', 'Paper only', NULL,
        'published', 129000,
        '2026-08-03T10:00:00.000Z', '2026-08-03T10:00:00.000Z'
      );
    INSERT INTO "product_images" (
      "id", "product_id", "url", "alt", "sort_order"
    ) VALUES
      (
        'forest-image-2', 'product-forest',
        'https://cdn.example.test/forest-2.webp', 'Forest back cover', 1
      ),
      (
        'forest-image-1', 'product-forest',
        'https://cdn.example.test/forest-1.webp', 'Forest cover', 0
      );
    INSERT INTO "colorings" (
      "id", "product_id", "slug", "title", "description", "position"
    ) VALUES
      (
        'coloring-forest-1', 'product-forest', 'forest-1',
        'Forest 1', 'First forest picture', 0
      ),
      (
        'coloring-forest-2', 'product-forest', 'forest-2',
        'Forest 2', 'Second forest picture', 1
      ),
      (
        'coloring-ocean-1', 'product-ocean', 'ocean-1',
        'Ocean 1', 'First ocean picture', 0
      );
  `);
  await insertLegacyRevision(db, "coloring-forest-1", "a".repeat(32), "a");
  await insertLegacyRevision(db, "coloring-forest-2", "b".repeat(32), "c");
  await db.exec(`
    UPDATE "colorings"
    SET "status" = 'published',
        "revision_sequence" = 1,
        "published_revision_id" = '${"a".repeat(32)}',
        "published_at" = '2026-08-02T10:00:00.123Z'
    WHERE "id" = 'coloring-forest-1';
    UPDATE "colorings"
    SET "status" = 'published',
        "revision_sequence" = 1,
        "published_revision_id" = '${"b".repeat(32)}',
        "published_at" = '2026-08-03T10:00:00.456Z'
    WHERE "id" = 'coloring-forest-2';
  `);

  return db;
}

async function insertLegacyRevision(
  db: PGlite,
  coloringId: string,
  revisionId: string,
  checksumSeed: string,
) {
  const outlineChecksum = checksumSeed.repeat(64);
  const coloredChecksum = (checksumSeed === "f" ? "e" : "f").repeat(64);

  await db.exec(`
    INSERT INTO "coloring_revisions" (
      "id", "coloring_id", "version", "palette_label", "palette_version",
      "used_color_count", "width", "height", "derivative_profile",
      "color_space", "outline_source_mime", "outline_source_checksum",
      "outline_storage_key", "outline_byte_size", "outline_checksum",
      "outline_alt", "colored_source_mime", "colored_source_checksum",
      "colored_storage_key", "colored_byte_size", "colored_checksum",
      "colored_alt"
    ) VALUES (
      '${revisionId}', '${coloringId}', 1, 'Artmate 168', '2026-08',
      12, 1200, 1600, 'webp-preview-v1', 'srgb', 'image/png',
      '${"d".repeat(64)}',
      '${coloringId}/${revisionId}/outline-${outlineChecksum}.webp',
      1024, '${outlineChecksum}', 'Outline', 'image/png',
      '${"e".repeat(64)}',
      '${coloringId}/${revisionId}/colored-${coloredChecksum}.webp',
      2048, '${coloredChecksum}', 'Colored version'
    )
  `);
}

function collectionInsertSql({
  coverAlt,
  coverHeight,
  coverUrl,
  coverWidth,
  expectedColoringCount = 25,
  id,
  position = 0,
  productId,
  publishedAt,
  slug,
  status = "draft",
  title,
}: {
  coverAlt?: string;
  coverHeight?: number;
  coverUrl?: string;
  coverWidth?: number;
  expectedColoringCount?: number;
  id: string;
  position?: number;
  productId: string;
  publishedAt?: string;
  slug: string;
  status?: "archived" | "draft" | "published";
  title: string;
}) {
  return `
    INSERT INTO "coloring_collections" (
      "id", "product_id", "slug", "title", "position",
      "expected_coloring_count", "status", "published_at",
      "cover_url", "cover_alt", "cover_width", "cover_height"
    ) VALUES (
      '${id}', '${productId}', '${slug}', '${title}', ${position},
      ${expectedColoringCount}, '${status}', ${sqlString(publishedAt)},
      ${sqlString(coverUrl)}, ${sqlString(coverAlt)},
      ${coverWidth ?? "NULL"}, ${coverHeight ?? "NULL"}
    )
  `;
}

function sqlString(value: string | undefined) {
  return value === undefined ? "NULL" : `'${value.replaceAll("'", "''")}'`;
}

async function rejectsConstraint(db: PGlite, sql: string) {
  await assert.rejects(db.exec(sql), (error: unknown) => {
    assert.match(String(error), /constraint|violates|duplicate|null value/i);

    return true;
  });
}
