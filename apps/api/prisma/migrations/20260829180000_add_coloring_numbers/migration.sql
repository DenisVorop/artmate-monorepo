DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "coloring_collections"
    WHERE "expected_coloring_count" > 99
  ) THEN
    RAISE EXCEPTION 'Coloring collection expected count exceeds the supported maximum of 99';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "coloring_collections" AS collection
    JOIN "colorings" AS coloring
      ON coloring."collection_id" = collection."id"
    GROUP BY collection."id", collection."expected_coloring_count"
    HAVING count(coloring."id") > collection."expected_coloring_count"
       OR count(coloring."id") > 99
  ) THEN
    RAISE EXCEPTION 'Coloring collection contains more colorings than its supported expected count';
  END IF;
END
$$;

ALTER TABLE "coloring_collections"
  DROP CONSTRAINT "coloring_collections_expected_count_check",
  ADD CONSTRAINT "coloring_collections_expected_count_check" CHECK (
    "expected_coloring_count" BETWEEN 1 AND 99
  );

ALTER TABLE "colorings"
  ADD COLUMN "number" INTEGER;

WITH "ranked_colorings" AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "collection_id"
      ORDER BY "position", "id"
    )::INTEGER AS "number"
  FROM "colorings"
)
UPDATE "colorings" AS coloring
SET "number" = ranked."number"
FROM "ranked_colorings" AS ranked
WHERE ranked."id" = coloring."id";

ALTER TABLE "colorings"
  ALTER COLUMN "number" SET NOT NULL,
  ALTER COLUMN "slug" DROP NOT NULL,
  ADD CONSTRAINT "colorings_number_check" CHECK (
    "number" BETWEEN 1 AND 99
  );

CREATE UNIQUE INDEX "colorings_collection_id_number_key"
  ON "colorings"("collection_id", "number");
