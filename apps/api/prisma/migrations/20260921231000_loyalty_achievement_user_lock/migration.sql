BEGIN;

-- Source capture and refund authors require User FK KEY SHARE while holding an
-- order lock. NO KEY UPDATE still serializes status/deletion changes, but is
-- compatible with those FK checks and avoids the User -> Order -> User cycle.
CREATE OR REPLACE FUNCTION guard_loyalty_achievement_award() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member loyalty_members%ROWTYPE;
  definition loyalty_achievement_definitions%ROWTYPE;
  revision loyalty_achievement_revisions%ROWTYPE;
  owner TEXT;
  proof RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Achievement awards are immutable'; END IF;
  SELECT user_id INTO owner FROM loyalty_members WHERE id = NEW.member_id;
  PERFORM id FROM users WHERE id = owner FOR NO KEY UPDATE;
  PERFORM id FROM orders WHERE user_id = owner ORDER BY id FOR UPDATE;
  PERFORM e.order_id FROM order_completion_eligibility e JOIN order_completion_facts f ON f.order_id = e.order_id
    WHERE f.user_id = owner ORDER BY e.order_id FOR SHARE OF e;
  SELECT * INTO member FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  SELECT * INTO definition FROM loyalty_achievement_definitions WHERE id = NEW.definition_id FOR SHARE;
  SELECT * INTO revision FROM loyalty_achievement_revisions WHERE definition_id = NEW.definition_id AND version = NEW.revision_version;
  IF member.id IS NULL OR member.user_id IS DISTINCT FROM owner OR member.status <> 'active' OR member.history_state NOT IN ('pending','ready') OR
    NOT EXISTS (SELECT 1 FROM users WHERE id = member.user_id AND status = 'active' AND deleted_at IS NULL) OR
    definition.id IS NULL OR definition.archived_at IS NOT NULL OR definition.active_version IS DISTINCT FROM NEW.revision_version OR
    revision.definition_id IS NULL OR revision.reward_points <> NEW.points OR NEW.awarded_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') THEN
    RAISE EXCEPTION 'Achievement award requires an eligible member and active matching revision'; END IF;
  SELECT * INTO proof FROM loyalty_achievement_qualification(member.user_id, revision.condition_kind, revision.target);
  IF (proof.publication_fact_id IS NULL AND proof.completion_order_id IS NULL) OR
    proof.publication_fact_id IS DISTINCT FROM NEW.publication_fact_id OR proof.qualified_at IS DISTINCT FROM NEW.qualified_at OR
    proof.completion_collection_id IS DISTINCT FROM NEW.completion_collection_id OR proof.completion_order_id IS DISTINCT FROM NEW.completion_order_id THEN
    RAISE EXCEPTION 'Achievement award does not match its source threshold proof'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
