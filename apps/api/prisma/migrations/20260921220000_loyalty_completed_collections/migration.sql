BEGIN;

CREATE TABLE coloring_collection_manifests (
  collection_id VARCHAR(32) PRIMARY KEY REFERENCES coloring_collections(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version = 1),
  expected_coloring_count INTEGER NOT NULL CHECK (expected_coloring_count > 0),
  captured_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC'),
  captured_transaction_id BIGINT NOT NULL DEFAULT txid_current()
);
CREATE TABLE coloring_collection_manifest_items (
  collection_id VARCHAR(32) NOT NULL REFERENCES coloring_collection_manifests(collection_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  number INTEGER NOT NULL CHECK (number > 0),
  coloring_id VARCHAR(32) NOT NULL REFERENCES colorings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revision_id VARCHAR(32) NOT NULL,
  PRIMARY KEY (collection_id, number),
  CONSTRAINT coloring_collection_manifest_items_coloring_id_revision_id_fkey
    FOREIGN KEY (coloring_id, revision_id) REFERENCES coloring_revisions(coloring_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX collection_manifest_items_collection_coloring_key
  ON coloring_collection_manifest_items(collection_id, coloring_id);
CREATE INDEX coloring_collection_manifest_items_coloring_id_revision_id_idx
  ON coloring_collection_manifest_items(coloring_id, revision_id);

-- Number is the album slot; position is only display ordering. A bare coloring
-- row does not prove upload: each slot must have a persisted uploaded revision.
CREATE FUNCTION coloring_collection_manifest_snapshot(target_collection TEXT)
RETURNS TABLE(number INTEGER, coloring_id VARCHAR(32), revision_id VARCHAR(32)) LANGUAGE sql STABLE AS $$
  SELECT c.number, c.id, r.id FROM colorings c
  JOIN LATERAL (
    SELECT id FROM coloring_revisions WHERE coloring_id = c.id ORDER BY version, id LIMIT 1
  ) r ON true
  WHERE c.collection_id = target_collection
$$;

CREATE FUNCTION check_coloring_collection_manifest(target_collection TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  manifest coloring_collection_manifests%ROWTYPE;
  expected_count INTEGER;
  actual_count BIGINT;
  first_number INTEGER;
  last_number INTEGER;
BEGIN
  SELECT * INTO manifest FROM coloring_collection_manifests WHERE collection_id = target_collection;
  SELECT expected_coloring_count INTO expected_count FROM coloring_collections WHERE id = target_collection FOR UPDATE;
  SELECT count(*), min(number), max(number) INTO actual_count, first_number, last_number
    FROM colorings WHERE collection_id = target_collection;
  IF manifest.collection_id IS NULL OR manifest.version <> 1 OR
    manifest.captured_transaction_id <> txid_current() OR
    manifest.captured_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') OR
    expected_count IS NULL OR manifest.expected_coloring_count <> expected_count OR
    actual_count <> expected_count OR first_number <> 1 OR last_number <> expected_count OR
    (SELECT count(*) FROM coloring_collection_manifest_items WHERE collection_id = target_collection) <> expected_count OR
    (SELECT count(*) FROM coloring_collection_manifest_snapshot(target_collection)) <> expected_count OR
    EXISTS (
      (SELECT number, coloring_id, revision_id FROM coloring_collection_manifest_items WHERE collection_id = target_collection
        EXCEPT SELECT number, coloring_id, revision_id FROM coloring_collection_manifest_snapshot(target_collection))
      UNION ALL
      (SELECT number, coloring_id, revision_id FROM coloring_collection_manifest_snapshot(target_collection)
        EXCEPT SELECT number, coloring_id, revision_id FROM coloring_collection_manifest_items WHERE collection_id = target_collection)
    ) THEN RAISE EXCEPTION 'Collection manifest requires the exact complete uploaded source composition'; END IF;
END;
$$;

CREATE FUNCTION guard_coloring_collection_manifest() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Collection manifests and items are immutable'; END IF;
  PERFORM check_coloring_collection_manifest(NEW.collection_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER coloring_collection_manifest_immutable BEFORE UPDATE OR DELETE ON coloring_collection_manifests
  FOR EACH ROW EXECUTE FUNCTION guard_coloring_collection_manifest();
CREATE TRIGGER coloring_collection_manifest_item_immutable BEFORE UPDATE OR DELETE ON coloring_collection_manifest_items
  FOR EACH ROW EXECUTE FUNCTION guard_coloring_collection_manifest();
CREATE CONSTRAINT TRIGGER coloring_collection_manifest_source AFTER INSERT ON coloring_collection_manifests
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_coloring_collection_manifest();
CREATE CONSTRAINT TRIGGER coloring_collection_manifest_item_source AFTER INSERT ON coloring_collection_manifest_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_coloring_collection_manifest();

CREATE FUNCTION capture_coloring_collection_manifest(target_collection TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  expected_count INTEGER;
  prior_transaction BIGINT;
BEGIN
  SELECT expected_coloring_count INTO expected_count FROM coloring_collections WHERE id = target_collection FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT captured_transaction_id INTO prior_transaction FROM coloring_collection_manifests WHERE collection_id = target_collection;
  IF FOUND THEN
    -- SET CONSTRAINTS IMMEDIATE cannot turn an intermediate composition into a fact.
    IF prior_transaction = txid_current() THEN PERFORM check_coloring_collection_manifest(target_collection); END IF;
    RETURN;
  END IF;
  IF expected_count < 1 OR
    (SELECT count(*) FROM colorings WHERE collection_id = target_collection) <> expected_count OR
    EXISTS (SELECT 1 FROM colorings WHERE collection_id = target_collection AND (number < 1 OR number > expected_count)) OR
    (SELECT count(*) FROM coloring_collection_manifest_snapshot(target_collection)) <> expected_count THEN RETURN; END IF;
  -- One statement also works when constraint triggers were made IMMEDIATE:
  -- the complete header and item set exists before end-of-statement validation.
  WITH captured AS (
    INSERT INTO coloring_collection_manifests(collection_id, expected_coloring_count)
      VALUES (target_collection, expected_count) RETURNING collection_id
  )
  INSERT INTO coloring_collection_manifest_items(collection_id, number, coloring_id, revision_id)
    SELECT captured.collection_id, s.number, s.coloring_id, s.revision_id
    FROM captured JOIN LATERAL coloring_collection_manifest_snapshot(captured.collection_id) s ON true;
END;
$$;

CREATE FUNCTION capture_changed_coloring_collection_manifests() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  old_collection TEXT;
  new_collection TEXT;
  target_collection TEXT;
BEGIN
  IF TG_TABLE_NAME = 'coloring_collections' THEN
    IF TG_OP = 'UPDATE' AND NEW.expected_coloring_count IS NOT DISTINCT FROM OLD.expected_coloring_count THEN RETURN NULL; END IF;
    new_collection := NEW.id;
  ELSIF TG_TABLE_NAME = 'colorings' THEN
    IF TG_OP = 'UPDATE' AND (NEW.collection_id, NEW.number) IS NOT DISTINCT FROM (OLD.collection_id, OLD.number) THEN RETURN NULL; END IF;
    IF TG_OP <> 'INSERT' THEN old_collection := OLD.collection_id; END IF;
    IF TG_OP <> 'DELETE' THEN new_collection := NEW.collection_id; END IF;
  ELSE
    IF TG_OP = 'UPDATE' AND (NEW.coloring_id, NEW.version) IS NOT DISTINCT FROM (OLD.coloring_id, OLD.version) THEN RETURN NULL; END IF;
    IF TG_OP <> 'INSERT' THEN SELECT collection_id INTO old_collection FROM colorings WHERE id = OLD.coloring_id; END IF;
    IF TG_OP <> 'DELETE' THEN SELECT collection_id INTO new_collection FROM colorings WHERE id = NEW.coloring_id; END IF;
  END IF;
  FOR target_collection IN SELECT DISTINCT id FROM unnest(ARRAY[old_collection, new_collection]) AS changed(id)
    WHERE id IS NOT NULL ORDER BY id LOOP
    PERFORM capture_coloring_collection_manifest(target_collection);
  END LOOP;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER coloring_collection_manifest_capture AFTER INSERT OR UPDATE ON coloring_collections
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_coloring_collection_manifests();
CREATE CONSTRAINT TRIGGER coloring_manifest_capture AFTER INSERT OR UPDATE OR DELETE ON colorings
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_coloring_collection_manifests();
CREATE CONSTRAINT TRIGGER coloring_revision_manifest_capture AFTER INSERT OR UPDATE OR DELETE ON coloring_revisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_coloring_collection_manifests();

-- Backfill observes complete uploaded compositions now, without invented earlier dates.
SELECT capture_coloring_collection_manifest(id) FROM coloring_collections ORDER BY id;

ALTER TABLE loyalty_achievement_awards ADD COLUMN completion_collection_id VARCHAR(32)
  REFERENCES coloring_collection_manifests(collection_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX loyalty_achievement_awards_completion_collection_id_idx ON loyalty_achievement_awards(completion_collection_id);

DROP FUNCTION loyalty_achievement_qualification(TEXT, loyalty_achievement_condition_kind, INTEGER);
CREATE FUNCTION loyalty_achievement_qualification(
  target_owner TEXT, target_kind loyalty_achievement_condition_kind, target_count INTEGER
) RETURNS TABLE(publication_fact_id TEXT, qualified_at TIMESTAMP(3), completion_collection_id VARCHAR(32)) LANGUAGE sql STABLE AS $$
  WITH coloring_facts AS (
    SELECT DISTINCT ON (coloring_id) id, coloring_id, collection_id, qualified_at
    FROM workshop_publication_facts WHERE owner_id = target_owner
    ORDER BY coloring_id, qualified_at, id
  ), simple_candidates AS (
    SELECT DISTINCT ON (condition_key) id, qualified_at FROM (
      SELECT id, qualified_at,
        CASE target_kind WHEN 'published_coloring_count' THEN coloring_id
          WHEN 'distinct_collection_count' THEN collection_id END AS condition_key
      FROM coloring_facts WHERE target_kind IN ('published_coloring_count', 'distinct_collection_count')
    ) facts ORDER BY condition_key, qualified_at, id
  ), completed_candidates AS (
    SELECT m.collection_id, greatest(m.captured_at, terminal.qualified_at) AS qualified_at, terminal.id
    FROM coloring_collection_manifests m
    JOIN LATERAL (
      SELECT f.id, f.qualified_at FROM coloring_collection_manifest_items i
      JOIN coloring_facts f ON f.coloring_id = i.coloring_id AND f.collection_id = i.collection_id
      WHERE i.collection_id = m.collection_id ORDER BY f.qualified_at DESC, f.id DESC LIMIT 1
    ) terminal ON true
    WHERE target_kind = 'completed_collection_count' AND NOT EXISTS (
      SELECT 1 FROM coloring_collection_manifest_items i WHERE i.collection_id = m.collection_id
        AND NOT EXISTS (SELECT 1 FROM coloring_facts f WHERE f.coloring_id = i.coloring_id AND f.collection_id = i.collection_id)
    )
  ), candidates AS (
    SELECT id, qualified_at, NULL::VARCHAR(32) AS completion_collection_id FROM simple_candidates
    UNION ALL
    SELECT id, qualified_at, collection_id FROM completed_candidates
  )
  SELECT id, qualified_at, completion_collection_id FROM candidates
    ORDER BY qualified_at, id, completion_collection_id OFFSET (target_count - 1) LIMIT 1
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
  IF OLD.archived_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Archived achievements are immutable'; END IF;
  IF NEW.current_version <> OLD.current_version AND
    (NEW.current_version::bigint <> OLD.current_version::bigint + 1 OR NEW.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Achievement version must advance by one on an editable definition';
  END IF;
  IF NEW.active_version IS DISTINCT FROM OLD.active_version THEN
    IF NEW.active_version IS NULL OR NEW.active_version <> NEW.current_version OR NEW.current_version <> OLD.current_version OR
      NEW.archived_at IS NOT NULL OR (OLD.active_version IS NOT NULL AND NEW.active_version <= OLD.active_version) OR
      NEW.activated_at IS NULL OR NEW.activated_by_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM loyalty_achievement_revisions r WHERE r.definition_id = NEW.id AND r.version = NEW.active_version
          AND r.condition_kind IN ('published_coloring_count', 'distinct_collection_count', 'completed_collection_count')
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
  SELECT * INTO revision FROM loyalty_achievement_revisions WHERE definition_id = NEW.definition_id AND version = NEW.revision_version;
  IF member.id IS NULL OR member.status <> 'active' OR member.history_state NOT IN ('pending','ready') OR
    NOT EXISTS (SELECT 1 FROM users WHERE id = member.user_id AND status = 'active' AND deleted_at IS NULL) OR
    definition.id IS NULL OR definition.archived_at IS NOT NULL OR definition.active_version IS DISTINCT FROM NEW.revision_version OR
    revision.definition_id IS NULL OR revision.condition_kind NOT IN ('published_coloring_count', 'distinct_collection_count', 'completed_collection_count') OR
    revision.reward_points <> NEW.points OR NEW.awarded_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement award requires an eligible member and active matching revision';
  END IF;
  SELECT * INTO proof FROM loyalty_achievement_qualification(member.user_id, revision.condition_kind, revision.target);
  IF proof.publication_fact_id IS NULL OR proof.publication_fact_id <> NEW.publication_fact_id OR
    proof.qualified_at IS DISTINCT FROM NEW.qualified_at OR
    proof.completion_collection_id IS DISTINCT FROM NEW.completion_collection_id THEN
    RAISE EXCEPTION 'Achievement award does not match its publication threshold and composition proof';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
