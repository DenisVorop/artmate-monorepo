CREATE TYPE "contest_selection_mode" AS ENUM ('AUTOMATIC', 'MANUAL');
ALTER TABLE "contests" ADD COLUMN "selection_mode" "contest_selection_mode" NOT NULL DEFAULT 'AUTOMATIC';

CREATE TABLE "contest_draws" (
  "id" VARCHAR(32) PRIMARY KEY,
  "contest_id" VARCHAR(32) NOT NULL UNIQUE REFERENCES "contests"("id") ON DELETE RESTRICT,
  "mode" "contest_selection_mode" NOT NULL,
  "actor_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "requested_winners" INTEGER NOT NULL CHECK ("requested_winners" BETWEEN 1 AND 100),
  "eligible_count" INTEGER NOT NULL CHECK ("eligible_count" >= 0),
  "eligibility" JSONB NOT NULL,
  "eligibility_hash" VARCHAR(64) NOT NULL,
  "selection_order" JSONB NOT NULL,
  "algorithm" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contest_draw_actor" CHECK (
    ("mode" = 'AUTOMATIC' AND "actor_id" IS NULL) OR
    ("mode" = 'MANUAL' AND "actor_id" IS NOT NULL)
  )
);
CREATE TABLE "contest_draw_winners" (
  "id" VARCHAR(32) PRIMARY KEY,
  "draw_id" VARCHAR(32) NOT NULL REFERENCES "contest_draws"("id") ON DELETE RESTRICT,
  "entry_id" VARCHAR(32) NOT NULL REFERENCES "contest_entries"("id") ON DELETE RESTRICT,
  "place" INTEGER NOT NULL CHECK ("place" BETWEEN 1 AND 100),
  "entry_version" INTEGER NOT NULL CHECK ("entry_version" > 0),
  "revision" INTEGER NOT NULL CHECK ("revision" > 0),
  UNIQUE ("draw_id", "place"),
  UNIQUE ("draw_id", "entry_id")
);
