CREATE TYPE "coloring_revision_review_decision" AS ENUM ('approved', 'rejected');

ALTER TABLE "colorings"
  ADD COLUMN "revision_sequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "published_revision_id" VARCHAR(32),
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "published_by_id" TEXT,
  ADD CONSTRAINT "colorings_revision_sequence_check"
    CHECK ("revision_sequence" >= 0),
  ADD CONSTRAINT "colorings_publication_state_check" CHECK (
    (
      "status" = 'published'
      AND "published_revision_id" IS NOT NULL
      AND "published_at" IS NOT NULL
    ) OR (
      "status" IN ('draft', 'archived')
      AND "published_revision_id" IS NULL
      AND "published_at" IS NULL
      AND "published_by_id" IS NULL
    )
  ),
  ADD CONSTRAINT "colorings_publisher_state_check" CHECK (
    "published_by_id" IS NULL OR "status" = 'published'
  );

CREATE TABLE "coloring_revisions" (
  "id" VARCHAR(32) NOT NULL,
  "coloring_id" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL,
  "palette_label" VARCHAR(120) NOT NULL,
  "palette_version" VARCHAR(80) NOT NULL,
  "used_color_count" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "derivative_profile" VARCHAR(40) NOT NULL,
  "color_space" VARCHAR(20) NOT NULL,
  "outline_source_mime" VARCHAR(20) NOT NULL,
  "outline_source_checksum" CHAR(64) NOT NULL,
  "outline_storage_key" TEXT NOT NULL,
  "outline_byte_size" INTEGER NOT NULL,
  "outline_checksum" CHAR(64) NOT NULL,
  "outline_alt" VARCHAR(220) NOT NULL,
  "colored_source_mime" VARCHAR(20) NOT NULL,
  "colored_source_checksum" CHAR(64) NOT NULL,
  "colored_storage_key" TEXT NOT NULL,
  "colored_byte_size" INTEGER NOT NULL,
  "colored_checksum" CHAR(64) NOT NULL,
  "colored_alt" VARCHAR(220) NOT NULL,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coloring_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coloring_revisions_id_check" CHECK (
    "id" ~ '^[0-9a-f]{32}$'
  ),
  CONSTRAINT "coloring_revisions_version_check" CHECK ("version" > 0),
  CONSTRAINT "coloring_revisions_metadata_check" CHECK (
    "palette_label" = btrim("palette_label")
    AND length("palette_label") > 0
    AND "palette_version" = btrim("palette_version")
    AND length("palette_version") > 0
    AND "outline_alt" = btrim("outline_alt")
    AND length("outline_alt") > 0
    AND "colored_alt" = btrim("colored_alt")
    AND length("colored_alt") > 0
  ),
  CONSTRAINT "coloring_revisions_used_color_count_check" CHECK (
    "used_color_count" BETWEEN 1 AND 168
  ),
  CONSTRAINT "coloring_revisions_dimensions_check" CHECK (
    "width" BETWEEN 1 AND 1600
    AND "height" BETWEEN 1 AND 1600
    AND "width"::BIGINT * "height"::BIGINT <= 2560000
  ),
  CONSTRAINT "coloring_revisions_profile_check" CHECK (
    "derivative_profile" = 'webp-preview-v1' AND "color_space" = 'srgb'
  ),
  CONSTRAINT "coloring_revisions_source_mime_check" CHECK (
    "outline_source_mime" IN ('image/png', 'image/webp')
    AND "colored_source_mime" IN ('image/png', 'image/webp')
  ),
  CONSTRAINT "coloring_revisions_byte_size_check" CHECK (
    "outline_byte_size" BETWEEN 1 AND 20971520
    AND "colored_byte_size" BETWEEN 1 AND 20971520
  ),
  CONSTRAINT "coloring_revisions_checksum_check" CHECK (
    "outline_source_checksum" ~ '^[0-9a-f]{64}$'
    AND "colored_source_checksum" ~ '^[0-9a-f]{64}$'
    AND "outline_checksum" ~ '^[0-9a-f]{64}$'
    AND "colored_checksum" ~ '^[0-9a-f]{64}$'
    AND "outline_checksum" <> "colored_checksum"
  ),
  CONSTRAINT "coloring_revisions_storage_key_check" CHECK (
    "outline_storage_key" ~ '^[a-z0-9_-]{1,32}/[0-9a-f]{32}/outline-[0-9a-f]{64}[.]webp$'
    AND "colored_storage_key" ~ '^[a-z0-9_-]{1,32}/[0-9a-f]{32}/colored-[0-9a-f]{64}[.]webp$'
    AND "outline_storage_key" = "coloring_id" || '/' || "id" || '/outline-' || "outline_checksum" || '.webp'
    AND "colored_storage_key" = "coloring_id" || '/' || "id" || '/colored-' || "colored_checksum" || '.webp'
    AND "outline_storage_key" <> "colored_storage_key"
  )
);

CREATE TABLE "coloring_revision_reviews" (
  "revision_id" VARCHAR(32) NOT NULL,
  "decision" "coloring_revision_review_decision" NOT NULL,
  "comment" TEXT,
  "reviewed_by_id" TEXT,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "coloring_revision_reviews_pkey" PRIMARY KEY ("revision_id"),
  CONSTRAINT "coloring_revision_reviews_comment_check" CHECK (
    "comment" IS NULL OR (
      "comment" = btrim("comment") AND length("comment") > 0
    )
  ),
  CONSTRAINT "coloring_revision_reviews_rejected_comment_check" CHECK (
    "decision" <> 'rejected' OR "comment" IS NOT NULL
  )
);

CREATE UNIQUE INDEX "colorings_published_revision_id_key"
  ON "colorings"("published_revision_id");
CREATE UNIQUE INDEX "colorings_id_published_revision_id_key"
  ON "colorings"("id", "published_revision_id");
CREATE UNIQUE INDEX "coloring_revisions_coloring_id_version_key"
  ON "coloring_revisions"("coloring_id", "version");
CREATE UNIQUE INDEX "coloring_revisions_coloring_id_id_key"
  ON "coloring_revisions"("coloring_id", "id");
CREATE UNIQUE INDEX "coloring_revisions_outline_storage_key_key"
  ON "coloring_revisions"("outline_storage_key");
CREATE UNIQUE INDEX "coloring_revisions_colored_storage_key_key"
  ON "coloring_revisions"("colored_storage_key");
CREATE INDEX "colorings_published_by_id_idx" ON "colorings"("published_by_id");
CREATE INDEX "coloring_revisions_created_by_id_idx"
  ON "coloring_revisions"("created_by_id");
CREATE INDEX "coloring_revision_reviews_reviewed_by_id_idx"
  ON "coloring_revision_reviews"("reviewed_by_id");

ALTER TABLE "coloring_revisions"
  ADD CONSTRAINT "coloring_revisions_coloring_id_fkey"
  FOREIGN KEY ("coloring_id") REFERENCES "colorings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coloring_revisions"
  ADD CONSTRAINT "coloring_revisions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "coloring_revision_reviews"
  ADD CONSTRAINT "coloring_revision_reviews_revision_id_fkey"
  FOREIGN KEY ("revision_id") REFERENCES "coloring_revisions"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "coloring_revision_reviews"
  ADD CONSTRAINT "coloring_revision_reviews_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "colorings"
  ADD CONSTRAINT "colorings_published_by_id_fkey"
  FOREIGN KEY ("published_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "colorings"
  ADD CONSTRAINT "colorings_published_revision_fkey"
  FOREIGN KEY ("id", "published_revision_id")
  REFERENCES "coloring_revisions"("coloring_id", "id")
  ON DELETE NO ACTION ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;
