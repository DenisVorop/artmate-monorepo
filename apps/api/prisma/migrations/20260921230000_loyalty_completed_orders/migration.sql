BEGIN;

CREATE TABLE order_completion_facts (
  order_id VARCHAR(32) PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  paid_at TIMESTAMP(3) NOT NULL,
  completed_at TIMESTAMP(3) NOT NULL,
  qualified_at TIMESTAMP(3) NOT NULL,
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  captured_at TIMESTAMP(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC'),
  captured_transaction_id BIGINT NOT NULL DEFAULT txid_current()
);
CREATE INDEX order_completion_facts_user_id_qualified_at_order_id_idx ON order_completion_facts(user_id, qualified_at, order_id);
CREATE TABLE order_completion_fact_items (
  order_id VARCHAR(32) NOT NULL REFERENCES order_completion_facts(order_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  product_id VARCHAR(191) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_id, product_id)
);
CREATE TABLE order_completion_eligibility (
  order_id VARCHAR(32) PRIMARY KEY REFERENCES order_completion_facts(order_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  retained_quantity INTEGER NOT NULL CHECK (retained_quantity >= 0),
  is_eligible BOOLEAN NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC')
);

-- Orders owns this evidence. No membership, reward rate, promo or cash-spend
-- filter participates. Incomplete legacy data produces no fact, never fake units.
CREATE FUNCTION order_completion_source_snapshot(target_order TEXT)
RETURNS TABLE(user_id TEXT, paid_at TIMESTAMP(3), completed_at TIMESTAMP(3), qualified_at TIMESTAMP(3), total_quantity INTEGER)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  source orders%ROWTYPE;
  units BIGINT;
BEGIN
  SELECT * INTO source FROM orders WHERE id = target_order;
  IF NOT FOUND OR source.user_id IS NULL OR source.payment_status <> 'paid' OR source.paid_at IS NULL OR
    source.crm_status <> 'completed' OR source.completed_at IS NULL OR
    NOT isfinite(source.paid_at) OR NOT isfinite(source.completed_at) OR
    source.paid_at < source.created_at OR source.completed_at < source.created_at THEN RETURN; END IF;
  SELECT sum(quantity) INTO units FROM order_items WHERE order_id = target_order;
  IF units IS NULL OR units <= 0 OR units <> source.items_count OR
    EXISTS (SELECT 1 FROM order_items WHERE order_id = target_order AND quantity <= 0) THEN RETURN; END IF;
  IF source.pricing_snapshot IS NOT NULL THEN
    BEGIN
      PERFORM validate_order_pricing_snapshot(source);
    EXCEPTION WHEN raise_exception OR data_exception THEN
      -- Capturing achievement evidence must not roll back a confirmed payment.
      RETURN;
    END;
  END IF;
  RETURN QUERY SELECT source.user_id, source.paid_at, source.completed_at,
    greatest(source.paid_at, source.completed_at), units::INTEGER;
END;
$$;

CREATE FUNCTION check_order_completion_fact(target_order TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  fact order_completion_facts%ROWTYPE;
  source RECORD;
BEGIN
  PERFORM id FROM orders WHERE id = target_order FOR UPDATE;
  SELECT * INTO fact FROM order_completion_facts WHERE order_id = target_order;
  SELECT * INTO source FROM order_completion_source_snapshot(target_order);
  IF fact.order_id IS NULL OR source.user_id IS NULL OR
    fact.captured_transaction_id <> txid_current() OR
    fact.captured_at IS DISTINCT FROM (CURRENT_TIMESTAMP(3) AT TIME ZONE 'UTC') OR
    (fact.user_id, fact.paid_at, fact.completed_at, fact.qualified_at, fact.total_quantity) IS DISTINCT FROM
    (source.user_id, source.paid_at, source.completed_at, source.qualified_at, source.total_quantity) OR
    EXISTS (
      (SELECT product_id, quantity FROM order_completion_fact_items WHERE order_id = target_order
        EXCEPT SELECT product_id, quantity FROM order_items WHERE order_id = target_order)
      UNION ALL
      (SELECT product_id, quantity FROM order_items WHERE order_id = target_order
        EXCEPT SELECT product_id, quantity FROM order_completion_fact_items WHERE order_id = target_order)
    ) THEN RAISE EXCEPTION 'Order completion fact requires matching paid completed order units'; END IF;
END;
$$;

CREATE FUNCTION guard_order_completion_fact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Order completion evidence is immutable'; END IF;
  PERFORM check_order_completion_fact(NEW.order_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER order_completion_fact_immutable BEFORE UPDATE OR DELETE ON order_completion_facts
  FOR EACH ROW EXECUTE FUNCTION guard_order_completion_fact();
CREATE TRIGGER order_completion_fact_item_immutable BEFORE UPDATE OR DELETE ON order_completion_fact_items
  FOR EACH ROW EXECUTE FUNCTION guard_order_completion_fact();
CREATE CONSTRAINT TRIGGER order_completion_fact_source AFTER INSERT ON order_completion_facts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_order_completion_fact();
CREATE CONSTRAINT TRIGGER order_completion_fact_item_source AFTER INSERT ON order_completion_fact_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION guard_order_completion_fact();

CREATE FUNCTION order_completion_eligibility_snapshot(target_order TEXT)
RETURNS TABLE(retained_quantity INTEGER, is_eligible BOOLEAN) LANGUAGE sql STABLE AS $$
  WITH returned AS (
    SELECT i.product_id, sum(i.quantity)::BIGINT AS quantity
    FROM order_refund_items i JOIN order_refunds r ON r.id = i.refund_id
    JOIN order_refund_events e ON e.refund_id = r.id
    WHERE r.order_id = target_order GROUP BY i.product_id
  ), remaining AS (
    SELECT sum(i.quantity - coalesce(r.quantity, 0))::BIGINT AS units
    FROM order_completion_fact_items i LEFT JOIN returned r ON r.product_id = i.product_id
    WHERE i.order_id = target_order
  ), valid AS (
    SELECT NOT EXISTS (
      SELECT 1 FROM returned r LEFT JOIN order_completion_fact_items i
        ON i.order_id = target_order AND i.product_id = r.product_id
      WHERE i.product_id IS NULL OR r.quantity < 0 OR r.quantity > i.quantity
    ) AS value
  )
  SELECT CASE WHEN v.value AND x.units >= 0 THEN x.units::INTEGER ELSE 0 END,
    coalesce(v.value AND x.units > 0 AND o.user_id = f.user_id AND o.payment_status = 'paid'
      AND o.paid_at IS NOT NULL AND isfinite(o.paid_at) AND o.paid_at >= o.created_at
      AND o.crm_status = 'completed' AND o.completed_at IS NOT NULL
      AND isfinite(o.completed_at) AND o.completed_at >= o.created_at, false)
  FROM order_completion_facts f JOIN orders o ON o.id = f.order_id CROSS JOIN remaining x CROSS JOIN valid v
  WHERE f.order_id = target_order
$$;

CREATE FUNCTION guard_order_completion_eligibility_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Order completion eligibility identity is permanent';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_completion_eligibility_identity BEFORE UPDATE OR DELETE ON order_completion_eligibility
  FOR EACH ROW EXECUTE FUNCTION guard_order_completion_eligibility_identity();

CREATE FUNCTION check_order_completion_eligibility() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  actual order_completion_eligibility%ROWTYPE;
  source RECORD;
BEGIN
  PERFORM id FROM orders WHERE id = NEW.order_id FOR UPDATE;
  SELECT * INTO actual FROM order_completion_eligibility WHERE order_id = NEW.order_id;
  SELECT * INTO source FROM order_completion_eligibility_snapshot(NEW.order_id);
  IF actual.order_id IS NULL OR source.retained_quantity IS NULL OR
    (actual.retained_quantity, actual.is_eligible) IS DISTINCT FROM (source.retained_quantity, source.is_eligible) THEN
    RAISE EXCEPTION 'Order completion eligibility does not match retained source units and status';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER order_completion_eligibility_source AFTER INSERT OR UPDATE ON order_completion_eligibility
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_order_completion_eligibility();

CREATE FUNCTION capture_order_completion(target_order TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  source RECORD;
  prior_transaction BIGINT;
BEGIN
  PERFORM id FROM orders WHERE id = target_order FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT captured_transaction_id INTO prior_transaction FROM order_completion_facts WHERE order_id = target_order;
  IF NOT FOUND THEN
    SELECT * INTO source FROM order_completion_source_snapshot(target_order);
    IF source.user_id IS NULL THEN RETURN; END IF;
    WITH captured AS (
      INSERT INTO order_completion_facts(order_id, user_id, paid_at, completed_at, qualified_at, total_quantity)
        VALUES (target_order, source.user_id, source.paid_at, source.completed_at, source.qualified_at, source.total_quantity)
        RETURNING order_id
    )
    INSERT INTO order_completion_fact_items(order_id, product_id, quantity)
      SELECT captured.order_id, i.product_id, i.quantity FROM captured JOIN order_items i ON i.order_id = captured.order_id;
  ELSIF prior_transaction = txid_current() THEN
    PERFORM check_order_completion_fact(target_order);
  END IF;
  INSERT INTO order_completion_eligibility(order_id, retained_quantity, is_eligible)
    SELECT target_order, retained_quantity, is_eligible FROM order_completion_eligibility_snapshot(target_order)
  ON CONFLICT (order_id) DO UPDATE SET retained_quantity = EXCLUDED.retained_quantity,
    is_eligible = EXCLUDED.is_eligible, updated_at = (clock_timestamp() AT TIME ZONE 'UTC')
  WHERE (order_completion_eligibility.retained_quantity, order_completion_eligibility.is_eligible)
    IS DISTINCT FROM (EXCLUDED.retained_quantity, EXCLUDED.is_eligible);
END;
$$;

CREATE FUNCTION capture_changed_order_completions() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target TEXT;
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'UPDATE' AND (NEW.user_id, NEW.payment_status, NEW.paid_at, NEW.crm_status, NEW.completed_at, NEW.items_count, NEW.pricing_snapshot)
      IS NOT DISTINCT FROM (OLD.user_id, OLD.payment_status, OLD.paid_at, OLD.crm_status, OLD.completed_at, OLD.items_count, OLD.pricing_snapshot) THEN RETURN NULL; END IF;
    target := NEW.id;
  ELSIF TG_TABLE_NAME = 'order_refund_events' THEN
    SELECT order_id INTO target FROM order_refunds WHERE id = NEW.refund_id;
  ELSE
    IF TG_OP = 'DELETE' THEN target := OLD.order_id; ELSE target := NEW.order_id; END IF;
    IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN PERFORM capture_order_completion(OLD.order_id); END IF;
  END IF;
  PERFORM capture_order_completion(target);
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER order_completion_capture AFTER INSERT OR UPDATE ON orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_order_completions();
CREATE CONSTRAINT TRIGGER order_item_completion_capture AFTER INSERT OR UPDATE OR DELETE ON order_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_order_completions();
CREATE CONSTRAINT TRIGGER order_refund_completion_capture AFTER INSERT ON order_refund_events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION capture_changed_order_completions();

CREATE FUNCTION guard_completed_order_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id AND EXISTS (SELECT 1 FROM order_completion_facts WHERE order_id = OLD.id) THEN
    RAISE EXCEPTION 'Completed order evidence owner is immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER completed_order_owner_guard BEFORE UPDATE OF user_id ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_completed_order_owner();

-- No membership dependency; qualifying historical orders are observed now.
SELECT capture_order_completion(id) FROM orders ORDER BY id;

ALTER TABLE loyalty_achievement_awards ALTER COLUMN publication_fact_id DROP NOT NULL;
ALTER TABLE loyalty_achievement_awards ADD COLUMN completion_order_id VARCHAR(32)
  REFERENCES order_completion_facts(order_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX loyalty_achievement_awards_completion_order_id_idx ON loyalty_achievement_awards(completion_order_id);
ALTER TABLE loyalty_achievement_awards ADD CONSTRAINT loyalty_achievement_awards_source_choice CHECK (
  (publication_fact_id IS NOT NULL AND completion_order_id IS NULL) OR
  (publication_fact_id IS NULL AND completion_order_id IS NOT NULL AND completion_collection_id IS NULL)
);

DROP FUNCTION loyalty_achievement_qualification(TEXT, loyalty_achievement_condition_kind, INTEGER);
CREATE FUNCTION loyalty_achievement_qualification(
  target_owner TEXT, target_kind loyalty_achievement_condition_kind, target_count INTEGER
) RETURNS TABLE(publication_fact_id TEXT, qualified_at TIMESTAMP(3), completion_collection_id VARCHAR(32), completion_order_id VARCHAR(32))
LANGUAGE sql STABLE AS $$
  WITH coloring_facts AS (
    SELECT DISTINCT ON (coloring_id) id, coloring_id, collection_id, qualified_at
    FROM workshop_publication_facts WHERE owner_id = target_owner ORDER BY coloring_id, qualified_at, id
  ), simple_candidates AS (
    SELECT DISTINCT ON (condition_key) id, qualified_at FROM (
      SELECT id, qualified_at, CASE target_kind WHEN 'published_coloring_count' THEN coloring_id
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
    SELECT id, qualified_at, NULL::VARCHAR(32) AS completion_collection_id, NULL::VARCHAR(32) AS completion_order_id FROM simple_candidates
    UNION ALL SELECT id, qualified_at, collection_id, NULL::VARCHAR(32) FROM completed_candidates
    UNION ALL
    SELECT NULL::TEXT, f.qualified_at, NULL::VARCHAR(32), f.order_id
    FROM order_completion_facts f JOIN order_completion_eligibility e ON e.order_id = f.order_id
    JOIN LATERAL order_completion_eligibility_snapshot(f.order_id) current_source ON true
    WHERE target_kind = 'completed_order_count' AND f.user_id = target_owner AND e.is_eligible AND e.retained_quantity > 0
      -- Also exclude a return inserted earlier in this transaction, before its
      -- deferred eligibility-publication trigger has run.
      AND current_source.is_eligible AND current_source.retained_quantity > 0
  )
  SELECT id, qualified_at, completion_collection_id, completion_order_id FROM candidates
    ORDER BY qualified_at, id, completion_collection_id, completion_order_id OFFSET (target_count - 1) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION loyalty_achievement_definition_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Achievement definitions cannot be deleted'; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.current_version <> 1 OR NEW.archived_at IS NOT NULL OR NEW.active_version IS NOT NULL OR NEW.activated_at IS NOT NULL OR NEW.activated_by_id IS NOT NULL THEN
      RAISE EXCEPTION 'Achievement definitions must start as version 1 drafts'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Achievement identity is immutable'; END IF;
  IF OLD.archived_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Archived achievements are immutable'; END IF;
  IF NEW.current_version <> OLD.current_version AND (NEW.current_version::bigint <> OLD.current_version::bigint + 1 OR NEW.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Achievement version must advance by one on an editable definition'; END IF;
  IF NEW.active_version IS DISTINCT FROM OLD.active_version THEN
    IF NEW.active_version IS NULL OR NEW.active_version <> NEW.current_version OR NEW.current_version <> OLD.current_version OR NEW.archived_at IS NOT NULL OR
      (OLD.active_version IS NOT NULL AND NEW.active_version <= OLD.active_version) OR NEW.activated_at IS NULL OR NEW.activated_by_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM loyalty_achievement_revisions r WHERE r.definition_id = NEW.id AND r.version = NEW.active_version
          AND r.condition_kind IN ('published_coloring_count', 'distinct_collection_count', 'completed_collection_count', 'completed_order_count')
      ) THEN RAISE EXCEPTION 'Achievement activation requires a supported current revision and must advance'; END IF;
  ELSIF NEW.activated_at IS DISTINCT FROM OLD.activated_at OR NEW.activated_by_id IS DISTINCT FROM OLD.activated_by_id THEN
    RAISE EXCEPTION 'Achievement activation audit is immutable without a new active revision'; END IF;
  RETURN NEW;
END;
$$;

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
  PERFORM id FROM users WHERE id = owner FOR UPDATE;
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
