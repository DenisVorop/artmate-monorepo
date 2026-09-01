CREATE TYPE "workshop_collection_source" AS ENUM ('manual', 'purchase', 'activation_code');
CREATE TYPE "workshop_revision_status" AS ENUM ('draft', 'pending', 'approved', 'changes_requested', 'hidden');
CREATE TYPE "workshop_tool_type" AS ENUM ('artmate_168', 'custom');
CREATE TYPE "workshop_moderation_decision" AS ENUM ('submitted', 'approved', 'changes_requested', 'hidden');
CREATE TYPE "workshop_report_reason" AS ENUM ('copyright', 'official_copy', 'inappropriate', 'spam', 'personal_data', 'other');
CREATE TYPE "workshop_report_status" AS ENUM ('open', 'reviewed', 'dismissed', 'actioned');

CREATE UNIQUE INDEX "colorings_collection_id_id_key"
  ON "colorings"("collection_id", "id");

CREATE TABLE "workshops" (
  "id" VARCHAR(32) NOT NULL,
  "owner_id" TEXT NOT NULL,
  "handle" VARCHAR(32) NOT NULL,
  "is_public" BOOLEAN NOT NULL DEFAULT false,
  "is_indexable" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshops_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshops_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshops_handle_check" CHECK ("handle" ~ '^[a-z0-9]{20}$'),
  CONSTRAINT "workshops_indexability_check" CHECK (NOT "is_indexable" OR "is_public")
);

CREATE TABLE "workshop_collections" (
  "workshop_id" VARCHAR(32) NOT NULL,
  "collection_id" VARCHAR(32) NOT NULL,
  "source" "workshop_collection_source" NOT NULL DEFAULT 'manual',
  "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_collections_pkey" PRIMARY KEY ("workshop_id", "collection_id")
);

CREATE TABLE "workshop_works" (
  "id" VARCHAR(32) NOT NULL,
  "public_id" VARCHAR(32) NOT NULL,
  "workshop_id" VARCHAR(32) NOT NULL,
  "collection_id" VARCHAR(32) NOT NULL,
  "coloring_id" VARCHAR(32) NOT NULL,
  "attempt_number" INTEGER NOT NULL DEFAULT 1,
  "revision_sequence" INTEGER NOT NULL DEFAULT 0,
  "current_revision_id" VARCHAR(32),
  "published_revision_id" VARCHAR(32),
  "is_publication_enabled" BOOLEAN NOT NULL DEFAULT false,
  "is_indexable" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_works_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_works_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshop_works_public_id_check" CHECK ("public_id" ~ '^[a-z0-9]{24}$'),
  CONSTRAINT "workshop_works_attempt_check" CHECK ("attempt_number" > 0),
  CONSTRAINT "workshop_works_sequence_check" CHECK ("revision_sequence" >= 0),
  CONSTRAINT "workshop_works_deleted_publication_check" CHECK (
    "deleted_at" IS NULL OR (NOT "is_publication_enabled" AND "is_indexable" = false)
  ),
  CONSTRAINT "workshop_works_indexability_check" CHECK (
    NOT "is_indexable" OR "is_publication_enabled"
  ),
  CONSTRAINT "workshop_works_publication_time_check" CHECK (
    "published_at" IS NULL OR "is_publication_enabled"
  )
);

CREATE TABLE "workshop_work_revisions" (
  "id" VARCHAR(32) NOT NULL,
  "work_id" VARCHAR(32) NOT NULL,
  "coloring_id" VARCHAR(32) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "official_revision_id" VARCHAR(32) NOT NULL,
  "status" "workshop_revision_status" NOT NULL DEFAULT 'draft',
  "caption" VARCHAR(500),
  "advertising_consent" BOOLEAN NOT NULL DEFAULT false,
  "crop_rotation" INTEGER NOT NULL,
  "crop_zoom" DOUBLE PRECISION NOT NULL,
  "crop_x" DOUBLE PRECISION NOT NULL,
  "crop_y" DOUBLE PRECISION NOT NULL,
  "source_mime" VARCHAR(20) NOT NULL,
  "source_checksum" CHAR(64) NOT NULL,
  "perceptual_hash" CHAR(16),
  "normalized_storage_key" TEXT NOT NULL,
  "normalized_checksum" CHAR(64) NOT NULL,
  "normalized_byte_size" INTEGER NOT NULL,
  "normalized_width" INTEGER NOT NULL,
  "normalized_height" INTEGER NOT NULL,
  "web_storage_key" TEXT NOT NULL,
  "web_checksum" CHAR(64) NOT NULL,
  "web_byte_size" INTEGER NOT NULL,
  "web_width" INTEGER NOT NULL,
  "web_height" INTEGER NOT NULL,
  "thumb_storage_key" TEXT NOT NULL,
  "thumb_checksum" CHAR(64) NOT NULL,
  "thumb_byte_size" INTEGER NOT NULL,
  "thumb_width" INTEGER NOT NULL,
  "thumb_height" INTEGER NOT NULL,
  "suspected_official_copy" BOOLEAN NOT NULL DEFAULT false,
  "submitted_at" TIMESTAMP(3),
  "moderated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_work_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_work_revisions_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshop_work_revisions_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "workshop_work_revisions_caption_check" CHECK (
    "caption" IS NULL OR ("caption" = btrim("caption") AND length("caption") > 0)
  ),
  CONSTRAINT "workshop_work_revisions_crop_check" CHECK (
    "crop_rotation" IN (0, 90, 180, 270)
    AND "crop_zoom" BETWEEN 1 AND 3
    AND "crop_x" BETWEEN -1 AND 1
    AND "crop_y" BETWEEN -1 AND 1
  ),
  CONSTRAINT "workshop_work_revisions_source_check" CHECK (
    "source_mime" IN ('image/jpeg', 'image/png', 'image/webp')
    AND "source_checksum" ~ '^[0-9a-f]{64}$'
    AND ("perceptual_hash" IS NULL OR "perceptual_hash" ~ '^[0-9a-f]{16}$')
  ),
  CONSTRAINT "workshop_work_revisions_status_time_check" CHECK (
    ("status" = 'draft' AND "submitted_at" IS NULL AND "moderated_at" IS NULL)
    OR ("status" = 'pending' AND "submitted_at" IS NOT NULL AND "moderated_at" IS NULL)
    OR ("status" IN ('approved', 'changes_requested', 'hidden') AND "submitted_at" IS NOT NULL AND "moderated_at" IS NOT NULL)
  ),
  CONSTRAINT "workshop_work_revisions_dimensions_check" CHECK (
    "normalized_width" > 0 AND "normalized_height" > 0
    AND "normalized_width" * 5 = "normalized_height" * 4
    AND "normalized_width" <= 1600 AND "normalized_height" <= 2000
    AND "web_width" > 0 AND "web_height" > 0
    AND "web_width" * 5 = "web_height" * 4
    AND "web_width" <= 1200 AND "web_height" <= 1500
    AND "thumb_width" > 0 AND "thumb_height" > 0
    AND "thumb_width" * 5 = "thumb_height" * 4
    AND "thumb_width" <= 320 AND "thumb_height" <= 400
  ),
  CONSTRAINT "workshop_work_revisions_bytes_check" CHECK (
    "normalized_byte_size" BETWEEN 1 AND 10485760
    AND "web_byte_size" BETWEEN 1 AND 10485760
    AND "thumb_byte_size" BETWEEN 1 AND 10485760
  ),
  CONSTRAINT "workshop_work_revisions_checksums_check" CHECK (
    "normalized_checksum" ~ '^[0-9a-f]{64}$'
    AND "web_checksum" ~ '^[0-9a-f]{64}$'
    AND "thumb_checksum" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "workshop_work_revisions_storage_keys_check" CHECK (
    "normalized_storage_key" ~ ('^' || "work_id" || '/[0-9a-f]{32}/normalized-' || "normalized_checksum" || '[.]webp$')
    AND "web_storage_key" ~ ('^' || "work_id" || '/[0-9a-f]{32}/web-' || "web_checksum" || '[.]webp$')
    AND "thumb_storage_key" ~ ('^' || "work_id" || '/[0-9a-f]{32}/thumb-' || "thumb_checksum" || '[.]webp$')
  )
);

CREATE TABLE "workshop_tools" (
  "id" VARCHAR(32) NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "workshop_tool_type" NOT NULL,
  "brand" VARCHAR(80) NOT NULL,
  "line" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_tools_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_tools_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshop_tools_names_check" CHECK (
    "brand" = btrim("brand") AND length("brand") > 0
    AND "line" = btrim("line") AND length("line") > 0
  ),
  CONSTRAINT "workshop_tools_artmate_check" CHECK (
    ("type" = 'artmate_168' AND "brand" = 'Artmate' AND "line" = '168')
    OR (
      "type" <> 'artmate_168'
      AND NOT (lower("brand") = 'artmate' AND "line" = '168')
    )
  )
);

CREATE TABLE "revision_materials" (
  "revision_id" VARCHAR(32) NOT NULL,
  "position" INTEGER NOT NULL,
  "tool_id" VARCHAR(32),
  "tool_type" "workshop_tool_type" NOT NULL,
  "brand" VARCHAR(80) NOT NULL,
  "line" VARCHAR(80) NOT NULL,
  CONSTRAINT "revision_materials_pkey" PRIMARY KEY ("revision_id", "position"),
  CONSTRAINT "revision_materials_position_check" CHECK ("position" BETWEEN 1 AND 10),
  CONSTRAINT "revision_materials_names_check" CHECK (
    "brand" = btrim("brand") AND length("brand") > 0
    AND "line" = btrim("line") AND length("line") > 0
  )
);

CREATE TABLE "revision_symbol_mappings" (
  "revision_id" VARCHAR(32) NOT NULL,
  "symbol" VARCHAR(1) NOT NULL,
  "material_position" INTEGER NOT NULL,
  "marker_number" VARCHAR(12) NOT NULL,
  "official_marker_color_id" VARCHAR(32),
  "official_color_number" INTEGER,
  "official_pantone" VARCHAR(40),
  "official_hex" VARCHAR(7),
  "official_marker_number" VARCHAR(3),
  CONSTRAINT "revision_symbol_mappings_pkey" PRIMARY KEY ("revision_id", "symbol"),
  CONSTRAINT "revision_symbol_mappings_symbol_check" CHECK ("symbol" ~ '^[1-9A-J]$'),
  CONSTRAINT "revision_symbol_mappings_material_position_check" CHECK ("material_position" BETWEEN 1 AND 10),
  CONSTRAINT "revision_symbol_mappings_marker_number_check" CHECK (
    "marker_number" = btrim("marker_number")
    AND "marker_number" ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$'
  ),
  CONSTRAINT "revision_symbol_mappings_official_snapshot_check" CHECK (
    ("official_marker_color_id" IS NULL AND "official_color_number" IS NULL AND "official_pantone" IS NULL AND "official_hex" IS NULL AND "official_marker_number" IS NULL)
    OR ("official_marker_color_id" IS NOT NULL AND "official_color_number" IS NOT NULL AND "official_pantone" IS NOT NULL AND "official_hex" ~ '^#[0-9A-F]{6}$' AND "official_marker_number" ~ '^[0-9]{3}$')
  )
);

CREATE TABLE "workshop_moderation_events" (
  "id" VARCHAR(32) NOT NULL,
  "work_id" VARCHAR(32) NOT NULL,
  "revision_id" VARCHAR(32) NOT NULL,
  "actor_id" TEXT NOT NULL,
  "decision" "workshop_moderation_decision" NOT NULL,
  "reason" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_moderation_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_moderation_events_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshop_moderation_events_reason_check" CHECK (
    ("decision" IN ('changes_requested', 'hidden') AND "reason" IS NOT NULL AND "reason" = btrim("reason") AND length("reason") > 0)
    OR ("decision" IN ('submitted', 'approved') AND ("reason" IS NULL OR ("reason" = btrim("reason") AND length("reason") > 0)))
  )
);

CREATE TABLE "workshop_work_reports" (
  "id" VARCHAR(32) NOT NULL,
  "work_id" VARCHAR(32) NOT NULL,
  "revision_id" VARCHAR(32) NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "reason" "workshop_report_reason" NOT NULL,
  "details" VARCHAR(500),
  "status" "workshop_report_status" NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_work_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_work_reports_id_check" CHECK ("id" ~ '^[0-9a-f]{32}$'),
  CONSTRAINT "workshop_work_reports_details_check" CHECK (
    "details" IS NULL OR ("details" = btrim("details") AND length("details") > 0)
  )
);

CREATE UNIQUE INDEX "workshops_owner_id_key" ON "workshops"("owner_id");
CREATE UNIQUE INDEX "workshops_handle_key" ON "workshops"("handle");
CREATE INDEX "workshops_is_public_handle_idx" ON "workshops"("is_public", "handle");
CREATE INDEX "workshop_collections_collection_id_idx" ON "workshop_collections"("collection_id");
CREATE UNIQUE INDEX "workshop_works_public_id_key" ON "workshop_works"("public_id");
CREATE UNIQUE INDEX "workshop_works_current_revision_id_key" ON "workshop_works"("current_revision_id");
CREATE UNIQUE INDEX "workshop_works_published_revision_id_key" ON "workshop_works"("published_revision_id");
CREATE UNIQUE INDEX "workshop_works_workshop_id_coloring_id_attempt_number_key" ON "workshop_works"("workshop_id", "coloring_id", "attempt_number");
CREATE UNIQUE INDEX "workshop_works_id_coloring_id_key" ON "workshop_works"("id", "coloring_id");
CREATE UNIQUE INDEX "workshop_works_id_current_revision_id_key" ON "workshop_works"("id", "current_revision_id");
CREATE UNIQUE INDEX "workshop_works_id_published_revision_id_key" ON "workshop_works"("id", "published_revision_id");
CREATE INDEX "workshop_works_workshop_id_collection_id_idx" ON "workshop_works"("workshop_id", "collection_id");
CREATE INDEX "workshop_works_collection_id_coloring_id_idx" ON "workshop_works"("collection_id", "coloring_id");
CREATE INDEX "workshop_works_coloring_id_deleted_at_is_publication_enabled_idx" ON "workshop_works"("coloring_id", "deleted_at", "is_publication_enabled");
CREATE UNIQUE INDEX "workshop_work_revisions_work_id_sequence_key" ON "workshop_work_revisions"("work_id", "sequence");
CREATE UNIQUE INDEX "workshop_work_revisions_work_id_id_key" ON "workshop_work_revisions"("work_id", "id");
CREATE INDEX "workshop_work_revisions_coloring_id_official_revision_id_idx" ON "workshop_work_revisions"("coloring_id", "official_revision_id");
CREATE INDEX "workshop_work_revisions_status_submitted_at_idx" ON "workshop_work_revisions"("status", "submitted_at");
CREATE UNIQUE INDEX "workshop_tools_user_id_type_brand_line_key" ON "workshop_tools"("user_id", "type", "brand", "line");
CREATE INDEX "workshop_tools_user_id_created_at_idx" ON "workshop_tools"("user_id", "created_at");
CREATE INDEX "revision_materials_tool_id_idx" ON "revision_materials"("tool_id");
CREATE INDEX "revision_symbol_mappings_official_marker_color_id_idx" ON "revision_symbol_mappings"("official_marker_color_id");
CREATE INDEX "workshop_moderation_events_revision_id_created_at_idx" ON "workshop_moderation_events"("revision_id", "created_at");
CREATE INDEX "workshop_moderation_events_work_id_created_at_idx" ON "workshop_moderation_events"("work_id", "created_at");
CREATE INDEX "workshop_moderation_events_actor_id_idx" ON "workshop_moderation_events"("actor_id");
CREATE UNIQUE INDEX "workshop_work_reports_revision_id_reporter_id_key" ON "workshop_work_reports"("revision_id", "reporter_id");
CREATE INDEX "workshop_work_reports_work_id_idx" ON "workshop_work_reports"("work_id");
CREATE INDEX "workshop_work_reports_status_created_at_idx" ON "workshop_work_reports"("status", "created_at");
CREATE INDEX "workshop_work_reports_reporter_id_idx" ON "workshop_work_reports"("reporter_id");

ALTER TABLE "workshops" ADD CONSTRAINT "workshops_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_collections" ADD CONSTRAINT "workshop_collections_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_collections" ADD CONSTRAINT "workshop_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "coloring_collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_works" ADD CONSTRAINT "workshop_works_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_works" ADD CONSTRAINT "workshop_works_membership_fkey" FOREIGN KEY ("workshop_id", "collection_id") REFERENCES "workshop_collections"("workshop_id", "collection_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_works" ADD CONSTRAINT "workshop_works_coloring_fkey" FOREIGN KEY ("collection_id", "coloring_id") REFERENCES "colorings"("collection_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_work_revisions" ADD CONSTRAINT "workshop_work_revisions_work_fkey" FOREIGN KEY ("work_id", "coloring_id") REFERENCES "workshop_works"("id", "coloring_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_work_revisions" ADD CONSTRAINT "workshop_work_revisions_official_revision_fkey" FOREIGN KEY ("coloring_id", "official_revision_id") REFERENCES "coloring_revisions"("coloring_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_works" ADD CONSTRAINT "workshop_works_current_revision_fkey" FOREIGN KEY ("id", "current_revision_id") REFERENCES "workshop_work_revisions"("work_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "workshop_works" ADD CONSTRAINT "workshop_works_published_revision_fkey" FOREIGN KEY ("id", "published_revision_id") REFERENCES "workshop_work_revisions"("work_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "workshop_tools" ADD CONSTRAINT "workshop_tools_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revision_materials" ADD CONSTRAINT "revision_materials_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "workshop_work_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revision_materials" ADD CONSTRAINT "revision_materials_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "workshop_tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revision_symbol_mappings" ADD CONSTRAINT "revision_symbol_mappings_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "workshop_work_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "revision_symbol_mappings" ADD CONSTRAINT "revision_symbol_mappings_material_fkey" FOREIGN KEY ("revision_id", "material_position") REFERENCES "revision_materials"("revision_id", "position") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "revision_symbol_mappings" ADD CONSTRAINT "revision_symbol_mappings_official_marker_color_id_fkey" FOREIGN KEY ("official_marker_color_id") REFERENCES "marker_colors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_moderation_events" ADD CONSTRAINT "workshop_moderation_events_revision_fkey" FOREIGN KEY ("work_id", "revision_id") REFERENCES "workshop_work_revisions"("work_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_moderation_events" ADD CONSTRAINT "workshop_moderation_events_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "workshop_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_moderation_events" ADD CONSTRAINT "workshop_moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "workshop_work_reports" ADD CONSTRAINT "workshop_work_reports_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "workshop_works"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_work_reports" ADD CONSTRAINT "workshop_work_reports_revision_fkey" FOREIGN KEY ("work_id", "revision_id") REFERENCES "workshop_work_revisions"("work_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workshop_work_reports" ADD CONSTRAINT "workshop_work_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "protect_workshop_revision_snapshot"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workshop revision snapshot is immutable';
END;
$$;

CREATE TRIGGER "workshop_revision_snapshot_immutable"
BEFORE UPDATE OF
  "id", "work_id", "coloring_id", "sequence", "official_revision_id",
  "caption", "advertising_consent", "crop_rotation", "crop_zoom", "crop_x", "crop_y",
  "source_mime", "source_checksum", "perceptual_hash",
  "normalized_storage_key", "normalized_checksum", "normalized_byte_size", "normalized_width", "normalized_height",
  "web_storage_key", "web_checksum", "web_byte_size", "web_width", "web_height",
  "thumb_storage_key", "thumb_checksum", "thumb_byte_size", "thumb_width", "thumb_height",
  "suspected_official_copy", "submitted_at", "created_at"
ON "workshop_work_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

CREATE TRIGGER "revision_materials_immutable"
BEFORE UPDATE OR DELETE ON "revision_materials"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

CREATE TRIGGER "revision_symbol_mappings_immutable"
BEFORE UPDATE OR DELETE ON "revision_symbol_mappings"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

CREATE FUNCTION "protect_workshop_moderation_event"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workshop moderation history is append-only';
END;
$$;

CREATE TRIGGER "workshop_moderation_events_append_only"
BEFORE UPDATE OR DELETE ON "workshop_moderation_events"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_moderation_event"();
