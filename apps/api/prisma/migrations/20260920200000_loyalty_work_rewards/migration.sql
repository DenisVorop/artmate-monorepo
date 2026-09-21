BEGIN;

-- Workshop owns this immutable source fact. Loyalty is only a consumer.
CREATE TABLE workshop_publication_facts (
  id TEXT PRIMARY KEY,
  work_id VARCHAR(32) NOT NULL,
  revision_id VARCHAR(32) NOT NULL,
  owner_id TEXT NOT NULL,
  coloring_id VARCHAR(32) NOT NULL,
  qualified_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  captured_transaction_id BIGINT NOT NULL DEFAULT txid_current(),
  CONSTRAINT workshop_publication_facts_work_id_fkey FOREIGN KEY (work_id)
    REFERENCES workshop_works(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT workshop_publication_facts_work_id_revision_id_fkey FOREIGN KEY (work_id, revision_id)
    REFERENCES workshop_work_revisions(work_id, id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT workshop_publication_facts_owner_id_fkey FOREIGN KEY (owner_id)
    REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT workshop_publication_facts_coloring_id_fkey FOREIGN KEY (coloring_id)
    REFERENCES colorings(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX workshop_publication_facts_work_id_key ON workshop_publication_facts(work_id);
CREATE INDEX workshop_publication_facts_owner_id_coloring_id_qualified_at_idx
  ON workshop_publication_facts(owner_id, coloring_id, qualified_at);
CREATE INDEX workshop_publication_facts_coloring_id_idx ON workshop_publication_facts(coloring_id);

-- Keep identical to publicWorkshopWorkWhere in workshop-eligibility.ts.
CREATE FUNCTION workshop_publication_snapshot(target_work_id TEXT)
RETURNS TABLE(work_id VARCHAR(32), revision_id VARCHAR(32), owner_id TEXT, coloring_id VARCHAR(32))
LANGUAGE sql STABLE AS $$
  SELECT w.id, r.id, s.owner_id, w.coloring_id
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

CREATE FUNCTION guard_workshop_publication_fact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Workshop publication facts are immutable';
  END IF;
  IF NEW.captured_transaction_id <> txid_current() OR
    NEW.qualified_at IS DISTINCT FROM CURRENT_TIMESTAMP(3)::TIMESTAMP(3) OR NOT EXISTS (
    SELECT 1 FROM workshop_publication_snapshot(NEW.work_id) s
    WHERE s.revision_id = NEW.revision_id AND s.owner_id = NEW.owner_id
      AND s.coloring_id = NEW.coloring_id
  ) THEN
    RAISE EXCEPTION 'Workshop publication fact requires a currently public approved source';
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER workshop_publication_fact_immutable BEFORE UPDATE OR DELETE ON workshop_publication_facts
FOR EACH ROW EXECUTE FUNCTION guard_workshop_publication_fact();
-- Revalidate inserts at commit so an intermediate public state cannot manufacture a fact.
CREATE CONSTRAINT TRIGGER workshop_publication_fact_source AFTER INSERT ON workshop_publication_facts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_workshop_publication_fact();

CREATE FUNCTION capture_workshop_publication(target_work_id TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize observations of different visibility dependencies for the same work.
  -- The following statement reads a fresh snapshot after a concurrent writer commits.
  PERFORM id FROM workshop_works WHERE id = target_work_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  -- SET CONSTRAINTS ... IMMEDIATE may have recorded and checked a fact earlier
  -- in this transaction. Such a fact still cannot outlive an intermediate public
  -- state; committed facts from older transactions are deliberately retained.
  IF EXISTS (
    SELECT 1 FROM workshop_publication_facts f
    WHERE f.work_id = target_work_id AND f.captured_transaction_id = txid_current()
      AND NOT EXISTS (
        SELECT 1 FROM workshop_publication_snapshot(target_work_id) s
        WHERE s.work_id = f.work_id AND s.revision_id = f.revision_id
          AND s.owner_id = f.owner_id AND s.coloring_id = f.coloring_id
      )
  ) THEN RAISE EXCEPTION 'Publication must remain public until commit'; END IF;
  INSERT INTO workshop_publication_facts(id, work_id, revision_id, owner_id, coloring_id)
  SELECT gen_random_uuid()::TEXT, s.work_id, s.revision_id, s.owner_id, s.coloring_id
  FROM workshop_publication_snapshot(target_work_id) s
  WHERE NOT EXISTS (SELECT 1 FROM workshop_publication_facts f WHERE f.work_id = s.work_id)
  ON CONFLICT (work_id) DO NOTHING;
END;
$$;

-- A source-row change visits only its related works through existing indexed FKs.
-- Deferred execution observes the final source state of moderation/publication transactions.
CREATE FUNCTION capture_changed_workshop_publications() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'workshop_works' THEN
    IF TG_OP = 'UPDATE' AND
      (NEW.workshop_id, NEW.collection_id, NEW.coloring_id, NEW.published_revision_id,
       NEW.is_publication_enabled, NEW.published_at, NEW.deleted_at) IS NOT DISTINCT FROM
      (OLD.workshop_id, OLD.collection_id, OLD.coloring_id, OLD.published_revision_id,
       OLD.is_publication_enabled, OLD.published_at, OLD.deleted_at) THEN RETURN NULL; END IF;
    PERFORM capture_workshop_publication(NEW.id);
  ELSIF TG_TABLE_NAME = 'workshop_work_revisions' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
    PERFORM capture_workshop_publication(NEW.work_id);
  ELSIF TG_TABLE_NAME = 'workshops' THEN
    IF TG_OP = 'UPDATE' AND (NEW.is_public, NEW.owner_id) IS NOT DISTINCT FROM
      (OLD.is_public, OLD.owner_id) THEN RETURN NULL; END IF;
    FOR target_id IN SELECT id FROM workshop_works WHERE workshop_id = NEW.id ORDER BY id LOOP
      PERFORM capture_workshop_publication(target_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'users' THEN
    IF TG_OP = 'UPDATE' AND (NEW.status, NEW.deleted_at) IS NOT DISTINCT FROM
      (OLD.status, OLD.deleted_at) THEN RETURN NULL; END IF;
    FOR target_id IN SELECT w.id FROM workshops s JOIN workshop_works w ON w.workshop_id = s.id
      WHERE s.owner_id = NEW.id ORDER BY w.id LOOP
      PERFORM capture_workshop_publication(target_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'colorings' THEN
    IF TG_OP = 'UPDATE' AND (NEW.status, NEW.published_revision_id, NEW.collection_id) IS NOT DISTINCT FROM
      (OLD.status, OLD.published_revision_id, OLD.collection_id) THEN RETURN NULL; END IF;
    FOR target_id IN SELECT id FROM workshop_works WHERE coloring_id = NEW.id ORDER BY id LOOP
      PERFORM capture_workshop_publication(target_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'coloring_collections' THEN
    IF TG_OP = 'UPDATE' AND (NEW.status, NEW.product_id) IS NOT DISTINCT FROM
      (OLD.status, OLD.product_id) THEN RETURN NULL; END IF;
    FOR target_id IN SELECT id FROM workshop_works WHERE collection_id = NEW.id ORDER BY id LOOP
      PERFORM capture_workshop_publication(target_id);
    END LOOP;
  ELSIF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
    FOR target_id IN SELECT w.id FROM coloring_collections cc JOIN workshop_works w ON w.collection_id = cc.id
      WHERE cc.product_id = NEW.id ORDER BY w.id LOOP
      PERFORM capture_workshop_publication(target_id);
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER workshop_work_publication_capture AFTER INSERT OR UPDATE ON workshop_works
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_revision_publication_capture AFTER INSERT OR UPDATE ON workshop_work_revisions
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_publication_capture AFTER INSERT OR UPDATE ON workshops
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_owner_publication_capture AFTER INSERT OR UPDATE ON users
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_coloring_publication_capture AFTER INSERT OR UPDATE ON colorings
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_collection_publication_capture AFTER INSERT OR UPDATE ON coloring_collections
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();
CREATE CONSTRAINT TRIGGER workshop_product_publication_capture AFTER INSERT OR UPDATE ON products
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_workshop_publications();

-- No assumption about earlier visibility: observe only works proven public now.
SELECT capture_workshop_publication(id) FROM workshop_works
WHERE deleted_at IS NULL AND is_publication_enabled AND published_at IS NOT NULL;

CREATE TABLE loyalty_work_rewards (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  coloring_id VARCHAR(32) NOT NULL REFERENCES colorings(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  publication_fact_id TEXT NOT NULL REFERENCES workshop_publication_facts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  points INTEGER NOT NULL DEFAULT 25,
  rules_version VARCHAR(64) NOT NULL DEFAULT 'work-v1',
  occurred_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loyalty_work_rewards_rules CHECK (points = 25 AND rules_version = 'work-v1')
);
CREATE UNIQUE INDEX loyalty_work_rewards_member_id_coloring_id_key ON loyalty_work_rewards(member_id, coloring_id);
CREATE INDEX loyalty_work_rewards_publication_fact_id_idx ON loyalty_work_rewards(publication_fact_id);
CREATE INDEX loyalty_work_rewards_coloring_id_idx ON loyalty_work_rewards(coloring_id);

CREATE TABLE loyalty_work_reward_syncs (
  member_id TEXT PRIMARY KEY REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loyalty_work_reward_syncs_attempts CHECK (attempts >= 0)
);
CREATE INDEX loyalty_work_reward_syncs_next_attempt_at_idx ON loyalty_work_reward_syncs(next_attempt_at);

ALTER TABLE loyalty_operations ADD COLUMN work_reward_id TEXT
  REFERENCES loyalty_work_rewards(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX loyalty_operations_work_reward_id_key ON loyalty_operations(work_reward_id);
ALTER TABLE loyalty_operations ADD CONSTRAINT loyalty_operations_work_reward_kind CHECK (
  work_reward_id IS NULL OR (kind = 'credit' AND reservation_id IS NULL AND refund_id IS NULL AND purchase_order_id IS NULL)
);

CREATE FUNCTION guard_loyalty_work_reward() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  member loyalty_members%ROWTYPE;
  fact workshop_publication_facts%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Loyalty work rewards are immutable'; END IF;
  SELECT * INTO member FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  SELECT * INTO fact FROM workshop_publication_facts WHERE id = NEW.publication_fact_id;
  IF member.id IS NULL OR fact.id IS NULL OR member.user_id <> fact.owner_id OR
    NEW.coloring_id <> fact.coloring_id OR NEW.occurred_at <> fact.qualified_at OR
    NEW.points <> 25 OR NEW.rules_version <> 'work-v1' OR
    member.status <> 'active' OR member.history_state NOT IN ('pending', 'ready') OR NOT EXISTS (
      SELECT 1 FROM users WHERE id = member.user_id AND status = 'active' AND deleted_at IS NULL
    ) THEN
    RAISE EXCEPTION 'Loyalty work reward does not match an eligible member and publication fact';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_work_reward_guard BEFORE INSERT OR UPDATE OR DELETE ON loyalty_work_rewards
FOR EACH ROW EXECUTE FUNCTION guard_loyalty_work_reward();

CREATE FUNCTION guard_loyalty_work_reward_member() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND EXISTS (
    SELECT 1 FROM loyalty_work_rewards WHERE member_id = OLD.id
  ) THEN RAISE EXCEPTION 'Loyalty work reward member owner is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_work_reward_member_guard BEFORE UPDATE OF user_id ON loyalty_members
FOR EACH ROW EXECUTE FUNCTION guard_loyalty_work_reward_member();

CREATE FUNCTION guard_loyalty_work_operation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reward loyalty_work_rewards%ROWTYPE;
  member loyalty_members%ROWTYPE;
  expected_key TEXT;
BEGIN
  IF NEW.work_reward_id IS NULL THEN
    IF NEW.operation_key LIKE 'coloring:%' OR NEW.source_key LIKE 'coloring:%' THEN
      RAISE EXCEPTION 'Coloring reward keys require a work reward account';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO reward FROM loyalty_work_rewards WHERE id = NEW.work_reward_id;
  SELECT * INTO member FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  expected_key := 'coloring:' || reward.member_id || ':' || reward.coloring_id;
  IF reward.id IS NULL OR member.id IS NULL OR member.status <> 'active' OR
    member.history_state NOT IN ('pending', 'ready') OR
    NEW.member_id <> reward.member_id OR NEW.kind <> 'credit' OR
    NEW.requested_points <> 25 OR NEW.balance_delta <> 25 OR NEW.reserved_delta <> 0 OR
    NEW.operation_key <> expected_key OR NEW.source_key <> expected_key OR
    NEW.rules_version <> reward.rules_version OR NEW.occurred_at <> reward.occurred_at OR
    NEW.reservation_id IS NOT NULL OR NEW.refund_id IS NOT NULL OR NEW.purchase_order_id IS NOT NULL OR
    NOT EXISTS (SELECT 1 FROM users u JOIN workshop_publication_facts f ON f.owner_id = u.id
      WHERE u.id = member.user_id AND u.status = 'active' AND u.deleted_at IS NULL
        AND f.id = reward.publication_fact_id AND f.coloring_id = reward.coloring_id
        AND f.qualified_at = reward.occurred_at) THEN
    RAISE EXCEPTION 'Loyalty work operation does not match its reward';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_work_operation_guard BEFORE INSERT ON loyalty_operations
FOR EACH ROW EXECUTE FUNCTION guard_loyalty_work_operation();

CREATE FUNCTION check_loyalty_work_reward_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_reward TEXT;
BEGIN
  IF TG_TABLE_NAME = 'loyalty_work_rewards' THEN target_reward := NEW.id;
  ELSE target_reward := NEW.work_reward_id; END IF;
  IF target_reward IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM loyalty_work_rewards r JOIN loyalty_operations o ON o.work_reward_id = r.id
    WHERE r.id = target_reward AND o.kind = 'credit' AND o.member_id = r.member_id
      AND o.requested_points = r.points AND o.balance_delta = r.points AND o.reserved_delta = 0
      AND o.rules_version = r.rules_version AND o.occurred_at = r.occurred_at
      AND o.operation_key = 'coloring:' || r.member_id || ':' || r.coloring_id
      AND o.source_key = o.operation_key
  ) THEN RAISE EXCEPTION 'Loyalty work reward requires exactly one matching credit'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER loyalty_work_reward_ledger AFTER INSERT ON loyalty_work_rewards
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_work_reward_ledger();
CREATE CONSTRAINT TRIGGER loyalty_work_operation_ledger AFTER INSERT ON loyalty_operations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_work_reward_ledger();

COMMIT;
