-- A footer belongs to its palette. Only the proven imported Artmate adaptation
-- may reuse its published legacy contour; the original contour is never a fallback.
BEGIN;
ALTER TABLE "coloring_material_variants"
  ADD COLUMN "outline_storage_key" TEXT,
  ADD COLUMN "outline_checksum" CHAR(64),
  ADD COLUMN "outline_byte_size" INTEGER,
  ADD COLUMN "outline_source_checksum" CHAR(64),
  ADD COLUMN "outline_source_mime" VARCHAR(40),
  ADD COLUMN "outline_alt" VARCHAR(220);

UPDATE "coloring_material_variants" v
SET "outline_storage_key" = r."outline_storage_key",
    "outline_checksum" = r."outline_checksum",
    "outline_byte_size" = r."outline_byte_size",
    "outline_source_checksum" = r."outline_source_checksum",
    "outline_source_mime" = r."outline_source_mime",
    "outline_alt" = r."outline_alt"
FROM "material_sets" s, "coloring_artworks" w,
     "colorings" c, "coloring_revisions" r
WHERE s."id" = v."material_set_id" AND s."slug" = 'artmate-168'
  AND w."coloring_id" = v."coloring_id"
  AND c."id" = v."coloring_id" AND c."status" = 'published'
  AND r."id" = c."published_revision_id" AND r."coloring_id" = c."id"
  AND v."status" = 'published' AND v."published_at" = r."first_published_at"
  AND w."width" = r."width" AND w."height" = r."height"
  AND w."derivative_profile" IN ('webp-preview-v1', 'webp-preview-v2', 'webp-preview-v3')
  AND r."derivative_profile" IN ('webp-preview-v1', 'webp-preview-v2', 'webp-preview-v3')
  AND w."color_space" = 'srgb' AND r."color_space" = 'srgb'
  AND v."image_storage_key" = r."colored_storage_key"
  AND v."image_checksum" = r."colored_checksum"
  AND v."image_byte_size" = r."colored_byte_size"
  AND v."source_checksum" = r."colored_source_checksum"
  AND v."source_mime" = r."colored_source_mime"
  AND v."image_alt" = r."colored_alt"
  AND v."card_storage_key" = r."card_storage_key"
  AND v."card_checksum" = r."card_checksum"
  AND v."card_byte_size" = r."card_byte_size"
  AND v."card_width" = r."card_width" AND v."card_height" = r."card_height"
  AND r."used_color_count" BETWEEN 1 AND 19
  AND (SELECT count(*) FROM "coloring_revision_palette_colors" p WHERE p."revision_id" = r."id") = r."used_color_count"
  AND (SELECT count(*) FROM "coloring_material_assignments" a WHERE a."variant_id" = v."id") = r."used_color_count"
  -- Count equality and every expected contiguous symbol prove the entire palette,
  -- including leading-zero codes, without RGB approximation or partial matching.
  AND NOT EXISTS (
    SELECT 1 FROM generate_series(1, r."used_color_count") expected(position)
    WHERE NOT EXISTS (
      SELECT 1 FROM "coloring_revision_palette_colors" p
      JOIN "coloring_material_assignments" a
        ON a."variant_id" = v."id" AND a."material_set_id" = s."id"
       AND a."symbol_position" = p."symbol_position"
      JOIN "material_colors" m
        ON m."id" = a."material_color_id" AND m."material_set_id" = s."id"
      WHERE p."revision_id" = r."id" AND p."symbol_position" = expected.position
        AND m."code" = p."marker_number" AND m."hex" = p."hex"
    )
  );

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "coloring_material_variants" WHERE "outline_storage_key" IS NULL) THEN
    RAISE EXCEPTION 'Cannot prove a paired contour for every material variant; no shared original fallback is allowed';
  END IF;
END $$;

ALTER TABLE "coloring_material_variants"
  ALTER COLUMN "outline_storage_key" SET NOT NULL,
  ALTER COLUMN "outline_checksum" SET NOT NULL,
  ALTER COLUMN "outline_byte_size" SET NOT NULL,
  ALTER COLUMN "outline_source_checksum" SET NOT NULL,
  ALTER COLUMN "outline_source_mime" SET NOT NULL,
  ALTER COLUMN "outline_alt" SET NOT NULL,
  ADD CONSTRAINT "coloring_material_variants_outline_size_check" CHECK ("outline_byte_size" > 0),
  ADD CONSTRAINT "coloring_material_variants_outline_checksums_check" CHECK ("outline_checksum" ~ '^[0-9a-f]{64}$' AND "outline_source_checksum" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "coloring_material_variants_outline_metadata_check" CHECK (length(btrim("outline_source_mime")) > 0 AND length(btrim("outline_alt")) > 0),
  ADD CONSTRAINT "coloring_material_variants_outline_storage_key_check" CHECK (length(btrim("outline_storage_key")) > 0 AND "outline_storage_key" <> "image_storage_key" AND "outline_storage_key" <> "card_storage_key");
CREATE UNIQUE INDEX "coloring_material_variants_outline_storage_key_key" ON "coloring_material_variants"("outline_storage_key");
COMMIT;
