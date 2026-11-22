-- CreateEnum
CREATE TYPE "contest_entry_status" AS ENUM ('PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "contest_entries" (
    "id" VARCHAR(32) NOT NULL,
    "public_id" VARCHAR(24) NOT NULL,
    "contest_id" VARCHAR(32) NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "contest_entry_status" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "contest_snapshot" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_entry_revisions" (
    "id" VARCHAR(32) NOT NULL,
    "entry_id" VARCHAR(32) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "product_id" VARCHAR(32) NOT NULL,
    "number" INTEGER,
    "caption" VARCHAR(500) NOT NULL,
    "assets" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_entry_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contest_entry_events" (
    "id" VARCHAR(32) NOT NULL,
    "entry_id" VARCHAR(32) NOT NULL,
    "actor_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "contest_entry_status" NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contest_entry_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contest_entries_public_id_key" ON "contest_entries"("public_id");

-- CreateIndex
CREATE INDEX "contest_entries_contest_id_status_created_at_idx" ON "contest_entries"("contest_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "contest_entries_status_published_at_id_idx" ON "contest_entries"("status", "published_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "contest_entries_contest_id_user_id_key" ON "contest_entries"("contest_id", "user_id");

-- CreateIndex
CREATE INDEX "contest_entry_revisions_product_id_idx" ON "contest_entry_revisions"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "contest_entry_revisions_entry_id_sequence_key" ON "contest_entry_revisions"("entry_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "contest_entry_events_entry_id_version_key" ON "contest_entry_events"("entry_id", "version");

-- AddForeignKey
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contest_id_fkey" FOREIGN KEY ("contest_id") REFERENCES "contests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entry_revisions" ADD CONSTRAINT "contest_entry_revisions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "contest_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entry_revisions" ADD CONSTRAINT "contest_entry_revisions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entry_events" ADD CONSTRAINT "contest_entry_events_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "contest_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contest_entry_events" ADD CONSTRAINT "contest_entry_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_positive_versions" CHECK (version > 0 AND revision > 0);
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_approved_publication" CHECK (status <> 'APPROVED' OR published_at IS NOT NULL);
ALTER TABLE "contest_entry_revisions" ADD CONSTRAINT "contest_entry_revisions_valid_number" CHECK (number IS NULL OR number BETWEEN 1 AND 99);
ALTER TABLE "contest_entry_revisions" ADD CONSTRAINT "contest_entry_revisions_positive_sequence" CHECK (sequence > 0);
ALTER TABLE "contest_entry_events" ADD CONSTRAINT "contest_entry_events_reason" CHECK (status IN ('PENDING', 'APPROVED') OR length(trim(reason)) > 0);
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_current_revision_fkey"
  FOREIGN KEY (id, revision) REFERENCES "contest_entry_revisions" (entry_id, sequence) DEFERRABLE INITIALLY DEFERRED;

CREATE VIEW contest_like_subjects_v1 AS
SELECT e.public_id AS subject_id, e.user_id AS owner_id,
       (e.status = 'APPROVED' AND e.published_at IS NOT NULL AND c.published
        AND u.status = 'active' AND u.deleted_at IS NULL) IS TRUE AS is_public,
       (u.status = 'deleted' OR u.deleted_at IS NOT NULL) AS is_deleted
FROM contest_entries e JOIN contests c ON c.id = e.contest_id JOIN users u ON u.id = e.user_id;
