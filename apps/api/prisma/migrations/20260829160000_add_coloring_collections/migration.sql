CREATE TYPE "coloring_collection_status" AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TABLE "coloring_collections" (
  "id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "expected_coloring_count" INTEGER NOT NULL DEFAULT 25,
  "status" "coloring_collection_status" NOT NULL DEFAULT 'draft',
  "cover_url" TEXT,
  "cover_alt" VARCHAR(220),
  "cover_width" INTEGER,
  "cover_height" INTEGER,
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coloring_collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coloring_collections_metadata_check" CHECK (
    "slug" = btrim("slug")
    AND length("slug") > 0
    AND "title" = btrim("title")
    AND length("title") > 0
  ),
  CONSTRAINT "coloring_collections_position_check" CHECK (
    "position" >= 0
  ),
  CONSTRAINT "coloring_collections_expected_count_check" CHECK (
    "expected_coloring_count" BETWEEN 1 AND 100
  ),
  CONSTRAINT "coloring_collections_publication_state_check" CHECK (
    (
      "status" = 'published'
      AND "published_at" IS NOT NULL
    ) OR (
      "status" IN ('draft', 'archived')
      AND "published_at" IS NULL
    )
  ),
  CONSTRAINT "coloring_collections_cover_state_check" CHECK (
    (
      "cover_url" IS NULL
      AND "cover_alt" IS NULL
      AND "cover_width" IS NULL
      AND "cover_height" IS NULL
    ) OR (
      "cover_url" IS NOT NULL
      AND "cover_url" = btrim("cover_url")
      AND length("cover_url") > 0
      AND "cover_alt" IS NOT NULL
      AND "cover_alt" = btrim("cover_alt")
      AND length("cover_alt") > 0
      AND "cover_width" IS NOT NULL
      AND "cover_width" > 0
      AND "cover_height" IS NOT NULL
      AND "cover_height" > 0
    )
  )
);

CREATE UNIQUE INDEX "coloring_collections_product_id_key"
  ON "coloring_collections"("product_id");
CREATE UNIQUE INDEX "coloring_collections_slug_key"
  ON "coloring_collections"("slug");
CREATE INDEX "coloring_collections_status_position_idx"
  ON "coloring_collections"("status", "position");

ALTER TABLE "coloring_collections"
  ADD CONSTRAINT "coloring_collections_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

WITH "collection_sources" AS (
  SELECT
    product."id" AS "product_id",
    product."slug",
    product."title",
    product."description",
    product."created_at",
    product."updated_at",
    bool_or(coloring."status" = 'published') AS "is_published",
    min(coloring."published_at") FILTER (
      WHERE coloring."status" = 'published'
    ) AS "published_at"
  FROM "products" AS product
  INNER JOIN "colorings" AS coloring
    ON coloring."product_id" = product."id"
  GROUP BY
    product."id",
    product."slug",
    product."title",
    product."description",
    product."created_at",
    product."updated_at"
)
INSERT INTO "coloring_collections" (
  "id",
  "product_id",
  "slug",
  "title",
  "description",
  "position",
  "expected_coloring_count",
  "status",
  "published_at",
  "created_at",
  "updated_at"
)
SELECT
  source."product_id",
  source."product_id",
  source."slug",
  source."title",
  source."description",
  (row_number() OVER (
    ORDER BY source."created_at", source."product_id"
  ) - 1)::INTEGER,
  25,
  CASE
    WHEN source."is_published" THEN 'published'::"coloring_collection_status"
    ELSE 'draft'::"coloring_collection_status"
  END,
  source."published_at",
  source."created_at",
  source."updated_at"
FROM "collection_sources" AS source;

ALTER TABLE "colorings"
  ADD COLUMN "collection_id" VARCHAR(32);

UPDATE "colorings" AS coloring
SET "collection_id" = collection."id"
FROM "coloring_collections" AS collection
WHERE collection."product_id" = coloring."product_id";

ALTER TABLE "colorings"
  ALTER COLUMN "collection_id" SET NOT NULL;

DROP INDEX "colorings_product_id_position_key";

ALTER TABLE "colorings"
  DROP CONSTRAINT "colorings_product_id_fkey";

ALTER TABLE "colorings"
  ADD CONSTRAINT "colorings_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "coloring_collections"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "colorings_collection_id_position_key"
  ON "colorings"("collection_id", "position");

ALTER TABLE "colorings"
  DROP COLUMN "product_id";

ALTER TABLE "coloring_revisions"
  ADD COLUMN "card_storage_key" TEXT,
  ADD COLUMN "card_byte_size" INTEGER,
  ADD COLUMN "card_checksum" CHAR(64),
  ADD COLUMN "card_width" INTEGER,
  ADD COLUMN "card_height" INTEGER,
  ADD CONSTRAINT "coloring_revisions_card_state_check" CHECK (
    (
      "card_storage_key" IS NULL
      AND "card_byte_size" IS NULL
      AND "card_checksum" IS NULL
      AND "card_width" IS NULL
      AND "card_height" IS NULL
    ) OR (
      "card_storage_key" IS NOT NULL
      AND length("card_storage_key") > 0
      AND "card_byte_size" IS NOT NULL
      AND "card_byte_size" > 0
      AND "card_checksum" IS NOT NULL
      AND "card_checksum" ~ '^[0-9a-f]{64}$'
      AND "card_width" IS NOT NULL
      AND "card_width" > 0
      AND "card_height" IS NOT NULL
      AND "card_height" > 0
    )
  );
