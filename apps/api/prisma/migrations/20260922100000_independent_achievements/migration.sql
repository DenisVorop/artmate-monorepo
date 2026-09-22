BEGIN;

-- This function belongs to achievements; no compatibility alias is retained.
ALTER FUNCTION loyalty_achievement_qualification(TEXT, loyalty_achievement_condition_kind, INTEGER)
  RENAME TO achievement_qualification;

CREATE TABLE achievement_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  definition_id UUID NOT NULL REFERENCES loyalty_achievement_definitions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  revision_version INTEGER NOT NULL,
  publication_fact_id TEXT REFERENCES workshop_publication_facts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  completion_order_id VARCHAR(32) REFERENCES order_completion_facts(order_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  completion_collection_id VARCHAR(32) REFERENCES coloring_collection_manifests(collection_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reward_points INTEGER NOT NULL CHECK (reward_points >= 0),
  qualified_at TIMESTAMP(3) NOT NULL,
  earned_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC'),
  CONSTRAINT achievement_badges_definition_id_revision_version_fkey FOREIGN KEY (definition_id, revision_version)
    REFERENCES loyalty_achievement_revisions(definition_id, version) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT achievement_badges_source_choice CHECK (
    (publication_fact_id IS NOT NULL AND completion_order_id IS NULL) OR
    (publication_fact_id IS NULL AND completion_order_id IS NOT NULL AND completion_collection_id IS NULL)
  )
);
CREATE UNIQUE INDEX achievement_badges_user_id_definition_id_key ON achievement_badges(user_id, definition_id);
CREATE INDEX achievement_badges_definition_id_revision_version_idx ON achievement_badges(definition_id, revision_version);
CREATE INDEX achievement_badges_publication_fact_id_idx ON achievement_badges(publication_fact_id);
CREATE INDEX achievement_badges_completion_order_id_idx ON achievement_badges(completion_order_id);
CREATE INDEX achievement_badges_completion_collection_id_idx ON achievement_badges(completion_collection_id);

CREATE TABLE achievement_syncs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX achievement_syncs_next_attempt_at_idx ON achievement_syncs(next_attempt_at);

-- Copy facts without requalification: archived definitions, blocked accounts and
-- subsequently returned orders do not erase previously earned badges.
INSERT INTO achievement_badges (id, user_id, definition_id, revision_version, publication_fact_id,
  completion_order_id, completion_collection_id, reward_points, qualified_at, earned_at)
SELECT a.id, m.user_id, a.definition_id, a.revision_version, a.publication_fact_id,
  a.completion_order_id, a.completion_collection_id, a.points, a.qualified_at, a.awarded_at
FROM loyalty_achievement_awards a JOIN loyalty_members m ON m.id = a.member_id;

ALTER TABLE loyalty_achievement_awards ADD COLUMN badge_id TEXT;
-- Only the immutable receipt guard is disabled while linking the historical
-- rows. Existing ids, award dates, source proofs and ledger operations stay intact.
ALTER TABLE loyalty_achievement_awards DISABLE TRIGGER loyalty_achievement_award_guard;
UPDATE loyalty_achievement_awards SET badge_id = id;
ALTER TABLE loyalty_achievement_awards ENABLE TRIGGER loyalty_achievement_award_guard;
ALTER TABLE loyalty_achievement_awards ALTER COLUMN badge_id SET NOT NULL;
ALTER TABLE loyalty_achievement_awards ADD CONSTRAINT loyalty_achievement_awards_badge_id_fkey
  FOREIGN KEY (badge_id) REFERENCES achievement_badges(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX loyalty_achievement_awards_badge_id_key ON loyalty_achievement_awards(badge_id);

CREATE FUNCTION guard_achievement_badge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  definition loyalty_achievement_definitions%ROWTYPE;
  revision loyalty_achievement_revisions%ROWTYPE;
  proof RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Achievement badges are immutable'; END IF;
  PERFORM id FROM users WHERE id = NEW.user_id FOR NO KEY UPDATE;
  PERFORM id FROM orders WHERE user_id = NEW.user_id ORDER BY id FOR UPDATE;
  PERFORM e.order_id FROM order_completion_eligibility e JOIN order_completion_facts f ON f.order_id = e.order_id
    WHERE f.user_id = NEW.user_id ORDER BY e.order_id FOR SHARE OF e;
  SELECT * INTO definition FROM loyalty_achievement_definitions WHERE id = NEW.definition_id FOR SHARE;
  SELECT * INTO revision FROM loyalty_achievement_revisions WHERE definition_id = NEW.definition_id AND version = NEW.revision_version;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND status = 'active' AND deleted_at IS NULL) OR
    definition.id IS NULL OR definition.archived_at IS NOT NULL OR definition.active_version IS DISTINCT FROM NEW.revision_version OR
    revision.definition_id IS NULL OR revision.reward_points <> NEW.reward_points OR
    NEW.earned_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement badge requires an active user and active matching revision'; END IF;
  SELECT * INTO proof FROM achievement_qualification(NEW.user_id, revision.condition_kind, revision.target);
  IF (proof.publication_fact_id IS NULL AND proof.completion_order_id IS NULL) OR
    proof.publication_fact_id IS DISTINCT FROM NEW.publication_fact_id OR proof.qualified_at IS DISTINCT FROM NEW.qualified_at OR
    proof.completion_collection_id IS DISTINCT FROM NEW.completion_collection_id OR proof.completion_order_id IS DISTINCT FROM NEW.completion_order_id THEN
    RAISE EXCEPTION 'Achievement badge does not match its source threshold proof'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER achievement_badge_guard BEFORE INSERT OR UPDATE OR DELETE ON achievement_badges
  FOR EACH ROW EXECUTE FUNCTION guard_achievement_badge();

-- Reward receipts consume only the published immutable badge. They must not
-- ask the current definition or mutable order eligibility to reconfirm it.
CREATE OR REPLACE FUNCTION guard_loyalty_achievement_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member loyalty_members%ROWTYPE;
  badge achievement_badges%ROWTYPE;
  owner TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Achievement awards are immutable'; END IF;
  SELECT user_id INTO owner FROM loyalty_members WHERE id = NEW.member_id;
  PERFORM id FROM users WHERE id = owner FOR NO KEY UPDATE;
  SELECT * INTO member FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  SELECT * INTO badge FROM achievement_badges WHERE id = NEW.badge_id;
  IF member.id IS NULL OR member.user_id IS DISTINCT FROM owner OR member.status <> 'active' OR member.history_state NOT IN ('pending','ready') OR
    NOT EXISTS (SELECT 1 FROM users WHERE id = member.user_id AND status = 'active' AND deleted_at IS NULL) OR
    badge.id IS NULL OR badge.user_id IS DISTINCT FROM member.user_id OR
    badge.definition_id IS DISTINCT FROM NEW.definition_id OR badge.revision_version IS DISTINCT FROM NEW.revision_version OR
    badge.reward_points IS DISTINCT FROM NEW.points OR badge.qualified_at IS DISTINCT FROM NEW.qualified_at OR
    badge.publication_fact_id IS DISTINCT FROM NEW.publication_fact_id OR
    badge.completion_collection_id IS DISTINCT FROM NEW.completion_collection_id OR
    badge.completion_order_id IS DISTINCT FROM NEW.completion_order_id OR
    NEW.awarded_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement reward requires an eligible member and matching persisted badge'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
