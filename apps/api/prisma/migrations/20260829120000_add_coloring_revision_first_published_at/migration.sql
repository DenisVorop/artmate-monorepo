ALTER TABLE "coloring_revisions"
ADD COLUMN "first_published_at" TIMESTAMP(3);

CREATE FUNCTION "stamp_coloring_revision_first_published_at"()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "coloring_revisions"
  SET "first_published_at" = NEW."published_at"
  WHERE "coloring_id" = NEW."id"
    AND "id" = NEW."published_revision_id"
    AND "first_published_at" IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "colorings_stamp_first_published_revision"
AFTER UPDATE OF "published_revision_id", "published_at", "status"
ON "colorings"
FOR EACH ROW
WHEN (
  NEW."status" = 'published'
  AND NEW."published_revision_id" IS NOT NULL
  AND NEW."published_at" IS NOT NULL
)
EXECUTE FUNCTION "stamp_coloring_revision_first_published_at"();

UPDATE "coloring_revisions" AS revision
SET "first_published_at" = coloring."published_at"
FROM "colorings" AS coloring
WHERE (revision."coloring_id", revision."id") =
      (coloring."id", coloring."published_revision_id")
  AND coloring."published_at" IS NOT NULL;
