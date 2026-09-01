-- Unmoderated workshop photos must never remain in the product. A draft can be
-- removed automatically only when it is an unreferenced metadata snapshot of
-- assets which already belong to a moderated revision. Any other draft needs a
-- deliberate data and object-storage cleanup before this migration can proceed.
BEGIN;

LOCK TABLE
  "workshop_work_revisions",
  "workshop_works",
  "workshop_moderation_events",
  "workshop_work_reports"
IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "workshop_work_revisions" draft
    WHERE draft."status" = 'draft'
      AND (
        EXISTS (
          SELECT 1
          FROM "workshop_works" work
          WHERE work."current_revision_id" = draft."id"
             OR work."published_revision_id" = draft."id"
        )
        OR EXISTS (
          SELECT 1
          FROM "workshop_moderation_events" event
          WHERE event."revision_id" = draft."id"
        )
        OR EXISTS (
          SELECT 1
          FROM "workshop_work_reports" report
          WHERE report."revision_id" = draft."id"
        )
        OR NOT EXISTS (
          SELECT 1
          FROM "workshop_work_revisions" moderated
          WHERE moderated."id" <> draft."id"
            AND moderated."work_id" = draft."work_id"
            AND moderated."status" IN ('approved', 'changes_requested', 'hidden')
            AND moderated."moderated_at" IS NOT NULL
            AND moderated."source_checksum" = draft."source_checksum"
            AND moderated."normalized_storage_key" = draft."normalized_storage_key"
            AND moderated."normalized_checksum" = draft."normalized_checksum"
            AND moderated."web_storage_key" = draft."web_storage_key"
            AND moderated."web_checksum" = draft."web_checksum"
            AND moderated."thumb_storage_key" = draft."thumb_storage_key"
            AND moderated."thumb_checksum" = draft."thumb_checksum"
        )
      )
  ) THEN
    RAISE EXCEPTION
      'unsafe workshop draft exists; review its pointers, history and stored assets before migrating';
  END IF;
END;
$$;

CREATE TEMPORARY TABLE "workshop_safe_draft_ids" (
  "id" VARCHAR(32) PRIMARY KEY
) ON COMMIT DROP;
INSERT INTO "workshop_safe_draft_ids" ("id")
SELECT "id" FROM "workshop_work_revisions" WHERE "status" = 'draft';

ALTER TABLE "workshop_work_revisions"
  DROP CONSTRAINT "workshop_work_revisions_status_time_check";
ALTER TABLE "workshop_work_revisions" ALTER COLUMN "status" DROP DEFAULT;
DROP TRIGGER "workshop_revision_snapshot_immutable" ON "workshop_work_revisions";

-- Move the guarded rows to a valid value before replacing the enum. They are
-- deleted below after every ALTER TABLE has finished, avoiding pending FK
-- trigger events during the enum/constraint changes.
UPDATE "workshop_work_revisions"
SET
  "status" = 'hidden',
  "submitted_at" = "created_at",
  "moderated_at" = "created_at"
WHERE "id" IN (SELECT "id" FROM "workshop_safe_draft_ids");

ALTER TYPE "workshop_revision_status" RENAME TO "workshop_revision_status_old";
CREATE TYPE "workshop_revision_status" AS ENUM (
  'pending',
  'approved',
  'changes_requested',
  'hidden'
);
ALTER TABLE "workshop_work_revisions"
  ALTER COLUMN "status" TYPE "workshop_revision_status"
  USING ("status"::text::"workshop_revision_status");
DROP TYPE "workshop_revision_status_old";
ALTER TABLE "workshop_work_revisions"
  ALTER COLUMN "status" SET DEFAULT 'pending';

ALTER TABLE "workshop_work_revisions"
  ADD COLUMN "advertising_consent_at" TIMESTAMP(3);
UPDATE "workshop_work_revisions"
SET "advertising_consent_at" = "submitted_at"
WHERE "advertising_consent";

ALTER TABLE "workshop_work_revisions"
  ADD CONSTRAINT "workshop_work_revisions_status_time_check" CHECK (
    ("status" = 'pending' AND "submitted_at" IS NOT NULL AND "moderated_at" IS NULL)
    OR (
      "status" IN ('approved', 'changes_requested', 'hidden')
      AND "submitted_at" IS NOT NULL
      AND "moderated_at" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "workshop_work_revisions_advertising_consent_check" CHECK (
    (
      "advertising_consent"
      AND "advertising_consent_at" IS NOT NULL
      AND "advertising_consent_at" = "submitted_at"
    )
    OR (NOT "advertising_consent" AND "advertising_consent_at" IS NULL)
  );

ALTER TABLE "revision_materials"
  DROP CONSTRAINT "revision_materials_position_check",
  ADD CONSTRAINT "revision_materials_position_check" CHECK (
    "position" BETWEEN 1 AND 19
  );

ALTER TABLE "revision_symbol_mappings"
  DROP CONSTRAINT "revision_symbol_mappings_material_position_check",
  ADD CONSTRAINT "revision_symbol_mappings_material_position_check" CHECK (
    "material_position" BETWEEN 1 AND 19
  );

CREATE TABLE "workshop_asset_deletion_jobs" (
  "id" VARCHAR(32) NOT NULL,
  "storage_key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workshop_asset_deletion_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workshop_asset_deletion_jobs_storage_key_key" UNIQUE ("storage_key"),
  CONSTRAINT "workshop_asset_deletion_jobs_id_check" CHECK (
    "id" ~ '^[0-9a-f]{32}$'
  ),
  CONSTRAINT "workshop_asset_deletion_jobs_storage_key_check" CHECK (
    "storage_key" ~ '^[0-9a-f]{32}/[0-9a-f]{32}/(normalized|web|thumb)-[0-9a-f]{64}[.]webp$'
  ),
  CONSTRAINT "workshop_asset_deletion_jobs_attempts_check" CHECK (
    "attempts" >= 0
  )
);

CREATE INDEX "workshop_asset_deletion_jobs_next_attempt_at_created_at_idx"
ON "workshop_asset_deletion_jobs"("next_attempt_at", "created_at");

ALTER TABLE "revision_symbol_mappings"
  DROP CONSTRAINT "revision_symbol_mappings_marker_number_check",
  ADD CONSTRAINT "revision_symbol_mappings_marker_number_check" CHECK (
    "marker_number" = btrim("marker_number")
    AND "marker_number" ~ '^$|^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$'
  );

CREATE TRIGGER "workshop_revision_snapshot_immutable"
BEFORE UPDATE OF
  "id", "work_id", "coloring_id", "sequence", "official_revision_id",
  "caption", "advertising_consent", "advertising_consent_at",
  "crop_rotation", "crop_zoom", "crop_x", "crop_y",
  "source_mime", "source_checksum", "perceptual_hash",
  "normalized_storage_key", "normalized_checksum", "normalized_byte_size", "normalized_width", "normalized_height",
  "web_storage_key", "web_checksum", "web_byte_size", "web_width", "web_height",
  "thumb_storage_key", "thumb_checksum", "thumb_byte_size", "thumb_width", "thumb_height",
  "suspected_official_copy", "submitted_at", "created_at"
ON "workshop_work_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_workshop_revision_snapshot"();

-- The child snapshot triggers normally forbid all deletes. Permit only the
-- cascades for the exact guarded rows, then restore the strict function.
CREATE OR REPLACE FUNCTION "protect_workshop_revision_snapshot"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (
    SELECT 1 FROM "workshop_safe_draft_ids" safe
    WHERE safe."id" = OLD."revision_id"
  ) THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'workshop revision snapshot is immutable';
END;
$$;

DELETE FROM "workshop_work_revisions"
WHERE "id" IN (SELECT "id" FROM "workshop_safe_draft_ids");

CREATE OR REPLACE FUNCTION "protect_workshop_revision_snapshot"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'workshop revision snapshot is immutable';
END;
$$;

COMMIT;
