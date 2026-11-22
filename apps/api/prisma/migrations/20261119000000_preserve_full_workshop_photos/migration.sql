BEGIN;

DROP TRIGGER "workshop_revision_snapshot_immutable" ON "workshop_work_revisions";

ALTER TABLE "workshop_work_revisions"
  DROP CONSTRAINT "workshop_work_revisions_crop_check",
  DROP COLUMN "crop_rotation",
  DROP COLUMN "crop_zoom",
  DROP COLUMN "crop_x",
  DROP COLUMN "crop_y",
  DROP CONSTRAINT "workshop_work_revisions_dimensions_check",
  ADD CONSTRAINT "workshop_work_revisions_dimensions_check" CHECK (
    "normalized_width" BETWEEN 1 AND 1600 AND "normalized_height" BETWEEN 1 AND 2000
    AND "web_width" BETWEEN 1 AND 1200 AND "web_height" BETWEEN 1 AND 1500
    AND "thumb_width" BETWEEN 1 AND 320 AND "thumb_height" BETWEEN 1 AND 400
  );

CREATE TRIGGER "workshop_revision_snapshot_immutable"
BEFORE UPDATE OF
  "id", "work_id", "coloring_id", "sequence", "official_revision_id",
  "caption", "advertising_consent", "advertising_consent_at",
  "publication_consent", "publication_consent_at",
  "source_mime", "source_checksum", "perceptual_hash",
  "normalized_storage_key", "normalized_checksum", "normalized_byte_size", "normalized_width", "normalized_height",
  "web_storage_key", "web_checksum", "web_byte_size", "web_width", "web_height",
  "thumb_storage_key", "thumb_checksum", "thumb_byte_size", "thumb_width", "thumb_height",
  "suspected_official_copy", "submitted_at", "created_at"
ON "workshop_work_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

COMMIT;
