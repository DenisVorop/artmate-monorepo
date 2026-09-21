BEGIN;

CREATE TYPE "loyalty_achievement_condition_kind" AS ENUM (
  'published_coloring_count', 'distinct_collection_count',
  'completed_collection_count', 'completed_order_count'
);

CREATE TABLE "loyalty_achievement_definitions" (
  "id" UUID NOT NULL,
  "current_version" INTEGER NOT NULL DEFAULT 1 CHECK ("current_version" >= 1),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_achievement_definitions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_achievement_definitions_id_current_version_key"
  ON "loyalty_achievement_definitions" ("id", "current_version");

CREATE TABLE "loyalty_achievement_revisions" (
  "definition_id" UUID NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" >= 1),
  "title" VARCHAR(120) NOT NULL CHECK (length(btrim("title")) > 0),
  "description" VARCHAR(1000) NOT NULL,
  "image_url" TEXT CHECK ("image_url" IS NULL OR "image_url" ~ '^https://[^[:space:]]+$'),
  "condition_kind" "loyalty_achievement_condition_kind" NOT NULL,
  "target" INTEGER NOT NULL CHECK ("target" >= 1),
  "reward_points" INTEGER NOT NULL CHECK ("reward_points" >= 0),
  "sort_order" INTEGER NOT NULL CHECK ("sort_order" >= 0),
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_achievement_revisions_pkey" PRIMARY KEY ("definition_id", "version"),
  CONSTRAINT "loyalty_achievement_revisions_definition_id_fkey" FOREIGN KEY ("definition_id")
    REFERENCES "loyalty_achievement_definitions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "loyalty_achievement_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id")
    REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX "loyalty_achievement_revisions_created_by_id_idx"
  ON "loyalty_achievement_revisions" ("created_by_id");

-- Prisma cannot express deferrability. This allows definition + first revision
-- to be inserted atomically, while a committed definition always has its revision.
ALTER TABLE "loyalty_achievement_definitions"
  ADD CONSTRAINT "loyalty_achievement_definitions_id_current_version_fkey"
  FOREIGN KEY ("id", "current_version")
  REFERENCES "loyalty_achievement_revisions"("definition_id", "version")
  ON DELETE RESTRICT ON UPDATE NO ACTION DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION loyalty_achievement_revision_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Achievement revisions are immutable';
END;
$$;
CREATE TRIGGER loyalty_achievement_revision_immutable
  BEFORE UPDATE OR DELETE ON "loyalty_achievement_revisions"
  FOR EACH ROW EXECUTE FUNCTION loyalty_achievement_revision_immutable();

CREATE FUNCTION loyalty_achievement_definition_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Achievement definitions cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_version <> 1 OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Achievement definitions must start as version 1 drafts';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Achievement identity is immutable';
  END IF;
  IF OLD.archived_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Archived achievements are immutable';
  END IF;
  IF NEW.current_version <> OLD.current_version THEN
    IF NEW.current_version::bigint <> OLD.current_version::bigint + 1
       OR NEW.archived_at IS NOT NULL THEN
      RAISE EXCEPTION 'Achievement version must advance by one on a draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_achievement_definition_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "loyalty_achievement_definitions"
  FOR EACH ROW EXECUTE FUNCTION loyalty_achievement_definition_guard();

COMMIT;
