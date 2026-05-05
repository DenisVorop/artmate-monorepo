CREATE TYPE "seo_entry_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "seo_snapshot_kind" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "seo_entries" (
  "id" VARCHAR(32) NOT NULL,
  "path" VARCHAR(2048) NOT NULL,
  "source" JSONB,
  "status" "seo_entry_status" NOT NULL DEFAULT 'draft',
  "draft_snapshot_id" VARCHAR(32),
  "published_snapshot_id" VARCHAR(32),
  "created_by_id" VARCHAR(32),
  "updated_by_id" VARCHAR(32),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seo_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seo_snapshots" (
  "id" VARCHAR(32) NOT NULL,
  "entry_id" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL,
  "kind" "seo_snapshot_kind" NOT NULL DEFAULT 'draft',
  "payload" JSONB NOT NULL,
  "comment" VARCHAR(500),
  "created_by_id" VARCHAR(32),
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seo_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seo_entries_path_key" ON "seo_entries"("path");
CREATE INDEX "seo_entries_status_updated_at_idx" ON "seo_entries"("status", "updated_at");
CREATE UNIQUE INDEX "seo_snapshots_entry_id_version_key" ON "seo_snapshots"("entry_id", "version");
CREATE INDEX "seo_snapshots_entry_id_created_at_idx" ON "seo_snapshots"("entry_id", "created_at");
CREATE INDEX "seo_snapshots_kind_created_at_idx" ON "seo_snapshots"("kind", "created_at");

ALTER TABLE "seo_snapshots"
  ADD CONSTRAINT "seo_snapshots_entry_id_fkey"
  FOREIGN KEY ("entry_id") REFERENCES "seo_entries"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
