BEGIN;

ALTER TABLE loyalty_achievement_definitions
  ADD COLUMN active_version INTEGER,
  ADD COLUMN activated_at TIMESTAMP(3),
  ADD COLUMN activated_by_id TEXT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT loyalty_achievement_definitions_active_fields CHECK (
    (active_version IS NULL AND activated_at IS NULL AND activated_by_id IS NULL) OR
    (active_version IS NOT NULL AND active_version >= 1 AND active_version <= current_version AND activated_at IS NOT NULL AND activated_by_id IS NOT NULL)
  ),
  ADD CONSTRAINT loyalty_achievement_definitions_id_active_version_fkey
    FOREIGN KEY (id, active_version) REFERENCES loyalty_achievement_revisions(definition_id, version)
    ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX loyalty_achievement_definitions_id_active_version_key
  ON loyalty_achievement_definitions(id, active_version);
CREATE INDEX loyalty_achievement_definitions_activated_by_id_idx ON loyalty_achievement_definitions(activated_by_id);

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
          AND r.version = NEW.active_version AND r.condition_kind = 'published_coloring_count'
      ) THEN RAISE EXCEPTION 'Achievement activation requires a supported current revision and must advance'; END IF;
  ELSIF NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by_id IS DISTINCT FROM OLD.activated_by_id THEN
    RAISE EXCEPTION 'Achievement activation audit is immutable without a new active revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE loyalty_achievement_awards (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  definition_id UUID NOT NULL REFERENCES loyalty_achievement_definitions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revision_version INTEGER NOT NULL,
  publication_fact_id TEXT NOT NULL REFERENCES workshop_publication_facts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  points INTEGER NOT NULL CHECK (points >= 0),
  qualified_at TIMESTAMP(3) NOT NULL,
  awarded_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC'),
  CONSTRAINT loyalty_achievement_awards_definition_id_revision_version_fkey
    FOREIGN KEY (definition_id, revision_version) REFERENCES loyalty_achievement_revisions(definition_id, version)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX loyalty_achievement_awards_member_id_definition_id_key ON loyalty_achievement_awards(member_id, definition_id);
CREATE INDEX loyalty_achievement_awards_definition_id_revision_version_idx ON loyalty_achievement_awards(definition_id, revision_version);
CREATE INDEX loyalty_achievement_awards_publication_fact_id_idx ON loyalty_achievement_awards(publication_fact_id);

CREATE TABLE loyalty_achievement_syncs (
  member_id TEXT PRIMARY KEY REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX loyalty_achievement_syncs_next_attempt_at_idx ON loyalty_achievement_syncs(next_attempt_at);

-- One canonical first observation per coloring. Later visibility and refund state
-- are deliberately absent: durable workshop facts are the published source contract.
CREATE FUNCTION loyalty_achievement_qualification(target_owner TEXT, target_count INTEGER)
RETURNS TABLE(publication_fact_id TEXT, qualified_at TIMESTAMP(3)) LANGUAGE sql STABLE AS $$
  SELECT f.id, f.qualified_at FROM (
    SELECT DISTINCT ON (coloring_id) id, qualified_at
    FROM workshop_publication_facts WHERE owner_id = target_owner
    ORDER BY coloring_id, qualified_at, id
  ) f ORDER BY f.qualified_at, f.id OFFSET (target_count - 1) LIMIT 1
$$;

CREATE FUNCTION guard_loyalty_achievement_award() RETURNS trigger LANGUAGE plpgsql AS $$
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
    revision.definition_id IS NULL OR revision.condition_kind <> 'published_coloring_count' OR
    revision.reward_points <> NEW.points OR NEW.awarded_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement award requires an eligible member and active matching revision';
  END IF;
  SELECT * INTO proof FROM loyalty_achievement_qualification(member.user_id, revision.target);
  IF proof.publication_fact_id IS NULL OR proof.publication_fact_id <> NEW.publication_fact_id OR
    proof.qualified_at IS DISTINCT FROM NEW.qualified_at THEN
    RAISE EXCEPTION 'Achievement award does not match the published coloring threshold';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_achievement_award_guard BEFORE INSERT OR UPDATE OR DELETE ON loyalty_achievement_awards
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_achievement_award();

CREATE FUNCTION guard_loyalty_achievement_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND EXISTS (
    SELECT 1 FROM loyalty_achievement_awards WHERE member_id = OLD.id
  ) THEN RAISE EXCEPTION 'Achievement member owner is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_achievement_member_guard BEFORE UPDATE OF user_id ON loyalty_members
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_achievement_member();

ALTER TABLE loyalty_operations ADD COLUMN achievement_award_id TEXT
  REFERENCES loyalty_achievement_awards(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX loyalty_operations_achievement_award_id_key ON loyalty_operations(achievement_award_id);
ALTER TABLE loyalty_operations ADD CONSTRAINT loyalty_operations_achievement_kind CHECK (
  achievement_award_id IS NULL OR (kind = 'credit' AND reservation_id IS NULL AND refund_id IS NULL
    AND purchase_order_id IS NULL AND work_reward_id IS NULL)
);

CREATE FUNCTION guard_loyalty_achievement_operation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  award loyalty_achievement_awards%ROWTYPE;
  expected_key TEXT;
BEGIN
  IF NEW.achievement_award_id IS NULL THEN
    IF NEW.operation_key LIKE 'achievement:%' OR NEW.source_key LIKE 'achievement:%' OR NEW.rules_version = 'achievement-v1' THEN
      RAISE EXCEPTION 'Achievement operation requires an achievement award';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO award FROM loyalty_achievement_awards WHERE id = NEW.achievement_award_id;
  expected_key := 'achievement:' || award.member_id || ':' || award.definition_id::text;
  IF award.id IS NULL OR award.points <= 0 OR NEW.member_id <> award.member_id OR NEW.kind <> 'credit' OR
    NEW.requested_points <> award.points OR NEW.balance_delta <> award.points OR NEW.reserved_delta <> 0 OR
    NEW.operation_key <> expected_key OR NEW.source_key <> expected_key OR NEW.rules_version <> 'achievement-v1' OR
    NEW.occurred_at IS DISTINCT FROM award.awarded_at OR NEW.reservation_id IS NOT NULL OR NEW.refund_id IS NOT NULL OR
    NEW.purchase_order_id IS NOT NULL OR NEW.work_reward_id IS NOT NULL THEN
    RAISE EXCEPTION 'Achievement operation does not match its award';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_achievement_operation_guard BEFORE INSERT ON loyalty_operations
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_achievement_operation();

CREATE FUNCTION check_loyalty_achievement_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_award TEXT;
  award loyalty_achievement_awards%ROWTYPE;
  operations BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'loyalty_achievement_awards' THEN target_award := NEW.id;
  ELSE target_award := NEW.achievement_award_id; END IF;
  IF target_award IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO award FROM loyalty_achievement_awards WHERE id = target_award;
  SELECT count(*) INTO operations FROM loyalty_operations WHERE achievement_award_id = target_award;
  IF (award.points = 0 AND operations <> 0) OR (award.points > 0 AND operations <> 1) THEN
    RAISE EXCEPTION 'Achievement award requires exactly one credit for positive points and none for zero points';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER loyalty_achievement_award_ledger AFTER INSERT ON loyalty_achievement_awards
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_achievement_ledger();
CREATE CONSTRAINT TRIGGER loyalty_achievement_operation_ledger AFTER INSERT ON loyalty_operations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_achievement_ledger();

COMMIT;
