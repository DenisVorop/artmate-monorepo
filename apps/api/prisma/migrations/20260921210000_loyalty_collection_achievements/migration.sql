BEGIN;

-- Keep the historical source relation stable during the one-time backfill.
LOCK TABLE workshop_works, colorings IN SHARE MODE;
ALTER TABLE workshop_publication_facts ADD COLUMN collection_id VARCHAR(32);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM workshop_publication_facts f
    LEFT JOIN workshop_works w ON w.id = f.work_id
    LEFT JOIN colorings c ON c.id = f.coloring_id
    WHERE w.id IS NULL OR c.id IS NULL OR w.coloring_id IS DISTINCT FROM f.coloring_id
      OR w.collection_id IS DISTINCT FROM c.collection_id
  ) THEN
    RAISE EXCEPTION 'Cannot backfill publication collection: preserved work and coloring relationship is inconsistent';
  END IF;
END;
$$;
-- Only this locked migration may populate the newly introduced snapshot column.
ALTER TABLE workshop_publication_facts DISABLE TRIGGER workshop_publication_fact_immutable;
UPDATE workshop_publication_facts f SET collection_id = w.collection_id
FROM workshop_works w WHERE w.id = f.work_id;
ALTER TABLE workshop_publication_facts ENABLE TRIGGER workshop_publication_fact_immutable;
ALTER TABLE workshop_publication_facts ALTER COLUMN collection_id SET NOT NULL;
ALTER TABLE workshop_publication_facts ADD CONSTRAINT workshop_publication_facts_collection_id_fkey
  FOREIGN KEY (collection_id) REFERENCES coloring_collections(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX workshop_publication_facts_owner_collection_qualified_idx
  ON workshop_publication_facts(owner_id, collection_id, qualified_at);
CREATE INDEX workshop_publication_facts_collection_id_idx ON workshop_publication_facts(collection_id);

-- Return shape changes, so replace this function rather than retain an alias.
DROP FUNCTION workshop_publication_snapshot(TEXT);
CREATE FUNCTION workshop_publication_snapshot(target_work_id TEXT)
RETURNS TABLE(work_id VARCHAR(32), revision_id VARCHAR(32), owner_id TEXT,
  coloring_id VARCHAR(32), collection_id VARCHAR(32)) LANGUAGE sql STABLE AS $$
  SELECT w.id, r.id, s.owner_id, w.coloring_id, w.collection_id
  FROM workshop_works w
  JOIN workshops s ON s.id = w.workshop_id
  JOIN users u ON u.id = s.owner_id
  JOIN workshop_work_revisions r ON r.work_id = w.id AND r.id = w.published_revision_id
  JOIN colorings c ON c.id = w.coloring_id AND c.collection_id = w.collection_id
  JOIN coloring_collections cc ON cc.id = c.collection_id
  JOIN products p ON p.id = cc.product_id
  WHERE w.id = target_work_id AND w.deleted_at IS NULL
    AND w.is_publication_enabled AND w.published_at IS NOT NULL
    AND w.published_revision_id IS NOT NULL AND r.status = 'approved'
    AND s.is_public AND u.status = 'active' AND u.deleted_at IS NULL
    AND c.status = 'published' AND c.published_revision_id IS NOT NULL
    AND cc.status = 'published' AND p.status = 'published'
$$;

CREATE OR REPLACE FUNCTION guard_workshop_publication_fact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Workshop publication facts are immutable'; END IF;
  IF NEW.captured_transaction_id <> txid_current() OR
    NEW.qualified_at IS DISTINCT FROM CURRENT_TIMESTAMP(3)::TIMESTAMP(3) OR NOT EXISTS (
      SELECT 1 FROM workshop_publication_snapshot(NEW.work_id) s
      WHERE s.revision_id = NEW.revision_id AND s.owner_id = NEW.owner_id
        AND s.coloring_id = NEW.coloring_id AND s.collection_id = NEW.collection_id
    ) THEN RAISE EXCEPTION 'Workshop publication fact requires a currently public approved source'; END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION capture_workshop_publication(target_work_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM id FROM workshop_works WHERE id = target_work_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- A snapshot created in this transaction must still match the final source;
  -- committed snapshots survive later hiding, edits and catalog reassignment.
  IF EXISTS (
    SELECT 1 FROM workshop_publication_facts f
    WHERE f.work_id = target_work_id AND f.captured_transaction_id = txid_current()
      AND NOT EXISTS (
        SELECT 1 FROM workshop_publication_snapshot(target_work_id) s
        WHERE s.work_id = f.work_id AND s.revision_id = f.revision_id
          AND s.owner_id = f.owner_id AND s.coloring_id = f.coloring_id
          AND s.collection_id = f.collection_id
      )
  ) THEN RAISE EXCEPTION 'Publication must remain public until commit'; END IF;
  INSERT INTO workshop_publication_facts(id, work_id, revision_id, owner_id, coloring_id, collection_id)
  SELECT gen_random_uuid()::TEXT, s.work_id, s.revision_id, s.owner_id, s.coloring_id, s.collection_id
  FROM workshop_publication_snapshot(target_work_id) s
  WHERE NOT EXISTS (SELECT 1 FROM workshop_publication_facts f WHERE f.work_id = s.work_id)
  ON CONFLICT (work_id) DO NOTHING;
END;
$$;

DROP FUNCTION loyalty_achievement_qualification(TEXT, INTEGER);
-- Every consumer uses the same deduplication and threshold proof: worker candidate
-- filtering, actual award creation, and the database source guard.
CREATE FUNCTION loyalty_achievement_qualification(
  target_owner TEXT, target_kind loyalty_achievement_condition_kind, target_count INTEGER
) RETURNS TABLE(publication_fact_id TEXT, qualified_at TIMESTAMP(3)) LANGUAGE sql STABLE AS $$
  -- A coloring belongs to the collection of its first durable publication.
  -- Reuploading it after a catalog move cannot manufacture another collection.
  WITH coloring_facts AS (
    SELECT DISTINCT ON (coloring_id) id, coloring_id, collection_id, qualified_at
    FROM workshop_publication_facts WHERE owner_id = target_owner
    ORDER BY coloring_id, qualified_at, id
  )
  SELECT f.id, f.qualified_at FROM (
    SELECT DISTINCT ON (condition_key) id, qualified_at FROM (
      SELECT id, qualified_at,
        CASE target_kind WHEN 'published_coloring_count' THEN coloring_id
          WHEN 'distinct_collection_count' THEN collection_id END AS condition_key
      FROM coloring_facts
      WHERE target_kind IN ('published_coloring_count', 'distinct_collection_count')
    ) facts ORDER BY condition_key, qualified_at, id
  ) f ORDER BY f.qualified_at, f.id OFFSET (target_count - 1) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION loyalty_achievement_definition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Achievement definitions cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_version <> 1 OR NEW.archived_at IS NOT NULL OR NEW.active_version IS NOT NULL OR
      NEW.activated_at IS NOT NULL OR NEW.activated_by_id IS NOT NULL THEN
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
  IF NEW.current_version <> OLD.current_version AND
    (NEW.current_version::bigint <> OLD.current_version::bigint + 1 OR NEW.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Achievement version must advance by one on an editable definition';
  END IF;
  IF NEW.active_version IS DISTINCT FROM OLD.active_version THEN
    IF NEW.active_version IS NULL OR NEW.active_version <> NEW.current_version OR
      NEW.current_version <> OLD.current_version OR NEW.archived_at IS NOT NULL OR
      (OLD.active_version IS NOT NULL AND NEW.active_version <= OLD.active_version) OR
      NEW.activated_at IS NULL OR NEW.activated_by_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM loyalty_achievement_revisions r WHERE r.definition_id = NEW.id
          AND r.version = NEW.active_version
          AND r.condition_kind IN ('published_coloring_count', 'distinct_collection_count')
      ) THEN RAISE EXCEPTION 'Achievement activation requires a supported current revision and must advance'; END IF;
  ELSIF NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by_id IS DISTINCT FROM OLD.activated_by_id THEN
    RAISE EXCEPTION 'Achievement activation audit is immutable without a new active revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_loyalty_achievement_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member loyalty_members%ROWTYPE;
  definition loyalty_achievement_definitions%ROWTYPE;
  revision loyalty_achievement_revisions%ROWTYPE;
  proof RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Achievement awards are immutable'; END IF;
  SELECT * INTO member FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  SELECT * INTO definition FROM loyalty_achievement_definitions WHERE id = NEW.definition_id FOR SHARE;
  SELECT * INTO revision FROM loyalty_achievement_revisions
    WHERE definition_id = NEW.definition_id AND version = NEW.revision_version;
  IF member.id IS NULL OR member.status <> 'active' OR member.history_state NOT IN ('pending','ready') OR
    NOT EXISTS (SELECT 1 FROM users WHERE id = member.user_id AND status = 'active' AND deleted_at IS NULL) OR
    definition.id IS NULL OR definition.archived_at IS NOT NULL OR
    definition.active_version IS DISTINCT FROM NEW.revision_version OR
    revision.definition_id IS NULL OR revision.condition_kind NOT IN ('published_coloring_count', 'distinct_collection_count') OR
    revision.reward_points <> NEW.points OR NEW.awarded_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement award requires an eligible member and active matching revision';
  END IF;
  SELECT * INTO proof FROM loyalty_achievement_qualification(member.user_id, revision.condition_kind, revision.target);
  IF proof.publication_fact_id IS NULL OR proof.publication_fact_id <> NEW.publication_fact_id OR
    proof.qualified_at IS DISTINCT FROM NEW.qualified_at THEN
    RAISE EXCEPTION 'Achievement award does not match its publication threshold';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
