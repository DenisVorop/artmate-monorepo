-- Expansion only: no data is copied, relabeled as original, or deleted here.
-- The existing API still references coloring_revisions. Its cutover and removal
-- must follow migration of workshop/manifest references, before feature release.
-- CreateEnum
CREATE TYPE "material_kind" AS ENUM ('marker', 'pencil', 'paint', 'other');

-- CreateTable
CREATE TABLE "coloring_artworks" (
    "coloring_id" VARCHAR(32) NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "derivative_profile" VARCHAR(40) NOT NULL,
    "color_space" VARCHAR(20) NOT NULL DEFAULT 'srgb',
    "outline_storage_key" TEXT NOT NULL,
    "outline_checksum" CHAR(64) NOT NULL,
    "outline_byte_size" INTEGER NOT NULL,
    "outline_source_checksum" CHAR(64) NOT NULL,
    "outline_source_mime" VARCHAR(40) NOT NULL,
    "outline_alt" VARCHAR(220) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coloring_artworks_pkey" PRIMARY KEY ("coloring_id")
);

-- CreateTable
CREATE TABLE "coloring_originals" (
    "coloring_id" VARCHAR(32) NOT NULL,
    "image_storage_key" TEXT NOT NULL,
    "image_checksum" CHAR(64) NOT NULL,
    "image_byte_size" INTEGER NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "source_mime" VARCHAR(40) NOT NULL,
    "image_alt" VARCHAR(220) NOT NULL,
    "card_storage_key" TEXT NOT NULL,
    "card_checksum" CHAR(64) NOT NULL,
    "card_byte_size" INTEGER NOT NULL,
    "card_width" INTEGER NOT NULL,
    "card_height" INTEGER NOT NULL,
    "status" "coloring_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coloring_originals_pkey" PRIMARY KEY ("coloring_id")
);

-- CreateTable
CREATE TABLE "coloring_original_colors" (
    "coloring_id" VARCHAR(32) NOT NULL,
    "symbol_position" INTEGER NOT NULL,
    "hex" VARCHAR(7) NOT NULL,

    CONSTRAINT "coloring_original_colors_pkey" PRIMARY KEY ("coloring_id","symbol_position")
);

-- CreateTable
CREATE TABLE "coloring_material_variants" (
    "id" VARCHAR(32) NOT NULL,
    "coloring_id" VARCHAR(32) NOT NULL,
    "material_set_id" VARCHAR(32) NOT NULL,
    "image_storage_key" TEXT NOT NULL,
    "image_checksum" CHAR(64) NOT NULL,
    "image_byte_size" INTEGER NOT NULL,
    "source_checksum" CHAR(64) NOT NULL,
    "source_mime" VARCHAR(40) NOT NULL,
    "image_alt" VARCHAR(220) NOT NULL,
    "card_storage_key" TEXT NOT NULL,
    "card_checksum" CHAR(64) NOT NULL,
    "card_byte_size" INTEGER NOT NULL,
    "card_width" INTEGER NOT NULL,
    "card_height" INTEGER NOT NULL,
    "status" "coloring_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coloring_material_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coloring_material_assignments" (
    "variant_id" VARCHAR(32) NOT NULL,
    "material_set_id" VARCHAR(32) NOT NULL,
    "material_color_id" VARCHAR(32) NOT NULL,
    "symbol_position" INTEGER NOT NULL,

    CONSTRAINT "coloring_material_assignments_pkey" PRIMARY KEY ("variant_id","symbol_position")
);

-- CreateTable
CREATE TABLE "material_sets" (
    "id" VARCHAR(32) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "brand" VARCHAR(120) NOT NULL,
    "line" VARCHAR(120),
    "kind" "material_kind" NOT NULL DEFAULT 'marker',
    "product_id" VARCHAR(32),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_colors" (
    "id" VARCHAR(32) NOT NULL,
    "material_set_id" VARCHAR(32) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120),
    "hex" VARCHAR(7) NOT NULL,
    "pantone" VARCHAR(40),
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_colors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coloring_artworks_outline_storage_key_key" ON "coloring_artworks"("outline_storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_originals_image_storage_key_key" ON "coloring_originals"("image_storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_originals_card_storage_key_key" ON "coloring_originals"("card_storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_material_variants_image_storage_key_key" ON "coloring_material_variants"("image_storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_material_variants_card_storage_key_key" ON "coloring_material_variants"("card_storage_key");

-- CreateIndex
CREATE INDEX "coloring_material_variants_material_set_id_idx" ON "coloring_material_variants"("material_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_material_variants_coloring_id_material_set_id_key" ON "coloring_material_variants"("coloring_id", "material_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "coloring_material_variants_id_material_set_id_key" ON "coloring_material_variants"("id", "material_set_id");

-- CreateIndex
CREATE INDEX "coloring_material_assignments_material_color_id_material_se_idx" ON "coloring_material_assignments"("material_color_id", "material_set_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_sets_slug_key" ON "material_sets"("slug");

-- CreateIndex
CREATE INDEX "material_sets_product_id_idx" ON "material_sets"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_colors_material_set_id_code_key" ON "material_colors"("material_set_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "material_colors_material_set_id_position_key" ON "material_colors"("material_set_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "material_colors_id_material_set_id_key" ON "material_colors"("id", "material_set_id");

-- AddForeignKey
ALTER TABLE "coloring_artworks" ADD CONSTRAINT "coloring_artworks_coloring_id_fkey" FOREIGN KEY ("coloring_id") REFERENCES "colorings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_originals" ADD CONSTRAINT "coloring_originals_coloring_id_fkey" FOREIGN KEY ("coloring_id") REFERENCES "coloring_artworks"("coloring_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_original_colors" ADD CONSTRAINT "coloring_original_colors_coloring_id_fkey" FOREIGN KEY ("coloring_id") REFERENCES "coloring_originals"("coloring_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_material_variants" ADD CONSTRAINT "coloring_material_variants_coloring_id_fkey" FOREIGN KEY ("coloring_id") REFERENCES "coloring_artworks"("coloring_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_material_variants" ADD CONSTRAINT "coloring_material_variants_material_set_id_fkey" FOREIGN KEY ("material_set_id") REFERENCES "material_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coloring_material_assignments" ADD CONSTRAINT "coloring_material_assignments_variant_id_material_set_id_fkey" FOREIGN KEY ("variant_id", "material_set_id") REFERENCES "coloring_material_variants"("id", "material_set_id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "coloring_material_assignments" ADD CONSTRAINT "coloring_material_assignments_material_color_id_material_s_fkey" FOREIGN KEY ("material_color_id", "material_set_id") REFERENCES "material_colors"("id", "material_set_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "material_sets" ADD CONSTRAINT "material_sets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_colors" ADD CONSTRAINT "material_colors_material_set_id_fkey" FOREIGN KEY ("material_set_id") REFERENCES "material_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain checks not expressible in Prisma.
ALTER TABLE "material_sets"
  ADD CONSTRAINT "material_sets_title_check" CHECK (length(btrim("title")) > 0),
  ADD CONSTRAINT "material_sets_brand_check" CHECK (length(btrim("brand")) > 0),
  ADD CONSTRAINT "material_sets_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

ALTER TABLE "material_colors"
  ADD CONSTRAINT "material_colors_code_check" CHECK (length(btrim("code")) > 0 AND "code" = btrim("code")),
  ADD CONSTRAINT "material_colors_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "material_colors_position_check" CHECK ("position" >= 0);

ALTER TABLE "coloring_artworks"
  ADD CONSTRAINT "coloring_artworks_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "width" <= 8000 AND "height" <= 8000 AND "width"::bigint * "height" <= 24000000),
  ADD CONSTRAINT "coloring_artworks_size_check" CHECK ("outline_byte_size" > 0),
  ADD CONSTRAINT "coloring_artworks_checksums_check" CHECK ("outline_checksum" ~ '^[0-9a-f]{64}$' AND "outline_source_checksum" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "coloring_artworks_storage_key_check" CHECK (length(btrim("outline_storage_key")) > 0),
  ADD CONSTRAINT "coloring_artworks_color_space_check" CHECK ("color_space" = 'srgb');

ALTER TABLE "coloring_original_colors"
  ADD CONSTRAINT "coloring_original_colors_symbol_check" CHECK ("symbol_position" BETWEEN 1 AND 19),
  ADD CONSTRAINT "coloring_original_colors_hex_check" CHECK ("hex" ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE "coloring_material_assignments"
  ADD CONSTRAINT "coloring_material_assignments_symbol_check" CHECK ("symbol_position" BETWEEN 1 AND 19);

ALTER TABLE "coloring_originals"
  ADD CONSTRAINT "coloring_originals_sizes_check" CHECK ("image_byte_size" > 0 AND "card_byte_size" > 0),
  ADD CONSTRAINT "coloring_originals_card_dimensions_check" CHECK ("card_width" BETWEEN 1 AND 640 AND "card_height" BETWEEN 1 AND 640),
  ADD CONSTRAINT "coloring_originals_checksums_check" CHECK ("image_checksum" ~ '^[0-9a-f]{64}$' AND "card_checksum" ~ '^[0-9a-f]{64}$' AND "source_checksum" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "coloring_originals_storage_keys_check" CHECK (length(btrim("image_storage_key")) > 0 AND length(btrim("card_storage_key")) > 0 AND "image_storage_key" <> "card_storage_key"),
  ADD CONSTRAINT "coloring_originals_publication_check" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL);

ALTER TABLE "coloring_material_variants"
  ADD CONSTRAINT "coloring_material_variants_sizes_check" CHECK ("image_byte_size" > 0 AND "card_byte_size" > 0),
  ADD CONSTRAINT "coloring_material_variants_card_dimensions_check" CHECK ("card_width" BETWEEN 1 AND 640 AND "card_height" BETWEEN 1 AND 640),
  ADD CONSTRAINT "coloring_material_variants_checksums_check" CHECK ("image_checksum" ~ '^[0-9a-f]{64}$' AND "card_checksum" ~ '^[0-9a-f]{64}$' AND "source_checksum" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "coloring_material_variants_storage_keys_check" CHECK (length(btrim("image_storage_key")) > 0 AND length(btrim("card_storage_key")) > 0 AND "image_storage_key" <> "card_storage_key"),
  ADD CONSTRAINT "coloring_material_variants_publication_check" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL);
