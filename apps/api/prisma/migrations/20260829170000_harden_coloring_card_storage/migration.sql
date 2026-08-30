ALTER TABLE "coloring_revisions"
  DROP CONSTRAINT "coloring_revisions_card_state_check";

ALTER TABLE "coloring_revisions"
  ADD CONSTRAINT "coloring_revisions_card_state_check" CHECK (
    (
      "card_storage_key" IS NULL
      AND "card_byte_size" IS NULL
      AND "card_checksum" IS NULL
      AND "card_width" IS NULL
      AND "card_height" IS NULL
    ) OR (
      "card_storage_key" IS NOT NULL
      AND "card_storage_key" ~ '^[a-z0-9_-]{1,32}/[0-9a-f]{32}/card-[0-9a-f]{64}[.]webp$'
      AND "card_checksum" IS NOT NULL
      AND "card_checksum" ~ '^[0-9a-f]{64}$'
      AND "card_storage_key" = "coloring_id" || '/' || "id" || '/card-' || "card_checksum" || '.webp'
      AND "card_byte_size" BETWEEN 1 AND 20971520
      AND "card_width" BETWEEN 1 AND 640
      AND "card_height" BETWEEN 1 AND 640
      AND "card_width"::BIGINT * "card_height"::BIGINT <= 409600
    )
  );

CREATE UNIQUE INDEX "coloring_revisions_card_storage_key_key"
  ON "coloring_revisions"("card_storage_key");
