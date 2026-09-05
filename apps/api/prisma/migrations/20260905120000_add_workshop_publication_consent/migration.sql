BEGIN;

ALTER TABLE "workshop_work_revisions"
  ADD COLUMN "publication_consent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publication_consent_at" TIMESTAMP(3),
  ADD CONSTRAINT "workshop_work_revisions_publication_consent_check" CHECK (
    (
      "publication_consent"
      AND "publication_consent_at" IS NOT NULL
      AND "publication_consent_at" = "submitted_at"
    )
    OR (NOT "publication_consent" AND "publication_consent_at" IS NULL)
  );

DROP TRIGGER "workshop_revision_snapshot_immutable"
ON "workshop_work_revisions";

CREATE TRIGGER "workshop_revision_snapshot_immutable"
BEFORE UPDATE OF
  "id", "work_id", "coloring_id", "sequence", "official_revision_id",
  "caption", "advertising_consent", "advertising_consent_at",
  "publication_consent", "publication_consent_at",
  "crop_rotation", "crop_zoom", "crop_x", "crop_y",
  "source_mime", "source_checksum", "perceptual_hash",
  "normalized_storage_key", "normalized_checksum", "normalized_byte_size", "normalized_width", "normalized_height",
  "web_storage_key", "web_checksum", "web_byte_size", "web_width", "web_height",
  "thumb_storage_key", "thumb_checksum", "thumb_byte_size", "thumb_width", "thumb_height",
  "suspected_official_copy", "submitted_at", "created_at"
ON "workshop_work_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

COMMIT;
