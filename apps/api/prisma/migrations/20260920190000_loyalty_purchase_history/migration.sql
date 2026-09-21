BEGIN;

ALTER TABLE loyalty_purchase_accounts
  ADD COLUMN historical_version VARCHAR(64),
  ADD COLUMN historical_spend_kopecks BIGINT,
  ADD CONSTRAINT loyalty_purchase_accounts_history_pair CHECK (
    (historical_version IS NULL AND historical_spend_kopecks IS NULL) OR
    (historical_version IS NOT NULL AND historical_version = 'purchase-history-v1'
      AND historical_spend_kopecks IS NOT NULL AND historical_spend_kopecks >= 0)
  );

CREATE TABLE loyalty_purchase_history_syncs (
  member_id TEXT PRIMARY KEY REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  active_transaction_id BIGINT,
  completed_at TIMESTAMP(3),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT loyalty_purchase_history_syncs_active CHECK (
    active_transaction_id IS NULL OR (active_transaction_id > 0 AND completed_at IS NULL)
  )
);
CREATE INDEX loyalty_purchase_history_syncs_next_attempt_at_idx
  ON loyalty_purchase_history_syncs(next_attempt_at);

-- Read-only reconstruction from the same published facts as history-preview.
-- All relevant sources are validated, including later refunds/transitions; those
-- later facts can invalidate evidence but cannot change the historical tier.
CREATE FUNCTION historical_purchase_spend(target_order_id TEXT) RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  target orders%ROWTYPE;
  source orders%ROWTYPE;
  transition RECORD;
  refund RECORD;
  previous_time TIMESTAMP(3);
  previous_status TEXT;
  historical_status TEXT;
  left_completed BOOLEAN;
  initial_creation BOOLEAN;
  from_status TEXT;
  to_status TEXT;
  cash NUMERIC;
  refund_cash NUMERIC;
  refund_delivery NUMERIC;
  historical_refund NUMERIC;
  spend NUMERIC := 0;
  statuses TEXT[] := ARRAY['new','in_progress','waiting_payment','paid','delivering','completed','cancelled'];
BEGIN
  SELECT * INTO target FROM orders WHERE id=target_order_id;
  IF NOT FOUND OR target.user_id IS NULL THEN
    RAISE EXCEPTION 'Historical purchase owner is missing';
  END IF;
  FOR source IN SELECT * FROM orders WHERE user_id=target.user_id ORDER BY created_at,id LOOP
    IF source.payment_status::text <> 'paid' AND source.paid_at IS NULL
      AND source.completed_at IS NULL AND source.crm_status::text <> 'completed'
      AND NOT EXISTS (SELECT 1 FROM order_refunds WHERE order_id=source.id) THEN
      CONTINUE;
    END IF;
    IF source.created_at IS NULL OR NOT isfinite(source.created_at)
      OR (source.paid_at IS NOT NULL AND (NOT isfinite(source.paid_at) OR source.paid_at < source.created_at))
      OR (source.completed_at IS NOT NULL AND (NOT isfinite(source.completed_at) OR source.completed_at < source.created_at))
      OR (source.payment_status::text = 'paid') IS DISTINCT FROM (source.paid_at IS NOT NULL)
      OR source.crm_status IS NULL OR NOT (source.crm_status::text = ANY(statuses))
      OR (source.crm_status::text = 'completed' AND source.completed_at IS NULL) THEN
      RAISE EXCEPTION 'Invalid historical order facts for %', source.id;
    END IF;
    PERFORM validate_order_pricing_snapshot(source);
    cash := (source.pricing_snapshot->>'itemsTotalKopecks')::NUMERIC;
    refund_cash := 0;
    refund_delivery := 0;
    historical_refund := 0;
    FOR refund IN SELECT r.*,e.refund_id AS published_refund_id,e.occurred_at AS published_at
      FROM order_refunds r LEFT JOIN order_refund_events e ON e.refund_id=r.id
      WHERE r.order_id=source.id LOOP
      IF refund.published_refund_id IS NULL OR refund.published_at IS DISTINCT FROM refund.created_at
        OR refund.created_at IS NULL OR NOT isfinite(refund.created_at)
        OR source.paid_at IS NULL OR refund.created_at < source.paid_at OR refund.created_at < source.created_at
        OR refund.delivery_kopecks IS NULL OR refund.delivery_kopecks < 0
        OR refund.total_kopecks IS NULL OR refund.total_kopecks < refund.delivery_kopecks THEN
        RAISE EXCEPTION 'Invalid historical refund facts for %', source.id;
      END IF;
      refund_cash := refund_cash + refund.total_kopecks::NUMERIC-refund.delivery_kopecks;
      refund_delivery := refund_delivery + refund.delivery_kopecks;
      IF refund.created_at < target.created_at THEN
        historical_refund := historical_refund + refund.total_kopecks::NUMERIC-refund.delivery_kopecks;
      END IF;
    END LOOP;
    IF refund_cash > cash OR refund_delivery > (source.pricing_snapshot->>'deliveryKopecks')::NUMERIC THEN
      RAISE EXCEPTION 'Invalid historical refund totals for %', source.id;
    END IF;
    previous_time := NULL;
    previous_status := NULL;
    historical_status := 'completed';
    left_completed := false;
    FOR transition IN SELECT * FROM order_history WHERE order_id=source.id AND event_type='status_changed'
      ORDER BY created_at,id LOOP
      from_status := transition.payload->>'fromStatus';
      to_status := transition.payload->>'toStatus';
      initial_creation := previous_time IS NULL
        AND jsonb_typeof(transition.payload->'fromStatus') IS NOT DISTINCT FROM 'null'
        AND transition.payload->>'source' IS NOT DISTINCT FROM 'order_created'
        AND to_status IS NOT DISTINCT FROM 'waiting_payment';
      IF (NOT initial_creation AND (jsonb_typeof(transition.payload->'fromStatus') IS DISTINCT FROM 'string'
          OR from_status IS NULL OR NOT (from_status = ANY(statuses))))
        OR jsonb_typeof(transition.payload->'toStatus') IS DISTINCT FROM 'string'
        OR NOT (to_status = ANY(statuses))
        OR transition.created_at IS NULL OR NOT isfinite(transition.created_at)
        OR transition.created_at < source.created_at
        OR (previous_time IS NOT NULL AND
          (previous_time = transition.created_at OR previous_status IS DISTINCT FROM from_status)) THEN
        RAISE EXCEPTION 'Incomplete historical status history for %', source.id;
      END IF;
      previous_time := transition.created_at;
      previous_status := to_status;
      IF transition.created_at >= source.completed_at THEN
        IF from_status = 'completed' THEN left_completed := true; END IF;
        IF transition.created_at < target.created_at THEN historical_status := to_status; END IF;
      END IF;
    END LOOP;
    IF (previous_status IS NOT NULL AND previous_status IS DISTINCT FROM source.crm_status::text)
      OR (source.completed_at IS NOT NULL AND source.crm_status::text <> 'completed' AND NOT left_completed) THEN
      RAISE EXCEPTION 'Incomplete historical status history for %', source.id;
    END IF;
    IF source.id <> target.id AND source.paid_at < target.created_at
      AND source.completed_at < target.created_at AND historical_status = 'completed' THEN
      spend := spend + cash-historical_refund;
    END IF;
  END LOOP;
  RETURN spend;
END;
$$;

CREATE OR REPLACE FUNCTION guard_loyalty_purchase_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_order orders%ROWTYPE;
  member_row loyalty_members%ROWTYPE;
  refunded NUMERIC;
  eligible_points NUMERIC;
  historical_spend NUMERIC;
  history_active BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Loyalty purchase accounts are permanent'; END IF;
  SELECT * INTO source_order FROM orders WHERE id=NEW.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty purchase order is missing'; END IF;
  SELECT * INTO member_row FROM loyalty_members WHERE id=NEW.member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty purchase member is missing'; END IF;
  SELECT coalesce(sum(r.total_kopecks-r.delivery_kopecks),0) INTO refunded
    FROM order_refunds r JOIN order_refund_events e ON e.refund_id=r.id WHERE r.order_id=NEW.order_id;
  IF NEW.refunded_kopecks IS DISTINCT FROM refunded THEN
    RAISE EXCEPTION 'Loyalty purchase refund total does not match published refunds';
  END IF;
  IF TG_OP = 'INSERT' THEN
    history_active := EXISTS (SELECT 1 FROM loyalty_purchase_history_syncs
      WHERE member_id=NEW.member_id AND active_transaction_id=txid_current());
    IF source_order.user_id IS DISTINCT FROM member_row.user_id OR
      source_order.payment_status::text <> 'paid' OR source_order.paid_at IS NULL OR
      source_order.crm_status::text <> 'completed' OR source_order.completed_at IS NULL OR
      member_row.status::text <> 'active' OR NOT (member_row.history_state::text = 'ready' OR
        (member_row.history_state::text = 'pending' AND history_active)) OR
      NOT EXISTS (SELECT 1 FROM users WHERE id=member_row.user_id AND status::text='active' AND deleted_at IS NULL) OR
      NEW.occurred_at IS DISTINCT FROM greatest(source_order.paid_at,source_order.completed_at) OR
      source_order.pricing_snapshot IS NULL THEN
      RAISE EXCEPTION 'Loyalty purchase account requires an eligible completed paid order';
    END IF;
    IF source_order.loyalty_rate_percent IS NULL AND source_order.loyalty_rate_version IS NULL THEN
      IF NOT history_active OR NEW.historical_version IS DISTINCT FROM 'purchase-history-v1'
        OR NEW.historical_spend_kopecks IS NULL THEN
        RAISE EXCEPTION 'Historical purchase requires an active history transaction and provenance';
      END IF;
      historical_spend := historical_purchase_spend(NEW.order_id);
      IF NEW.historical_spend_kopecks IS DISTINCT FROM historical_spend OR
        NEW.rate_percent IS DISTINCT FROM (CASE WHEN historical_spend >= 1200000 THEN 10
          WHEN historical_spend >= 700000 THEN 7 WHEN historical_spend >= 300000 THEN 5 ELSE 3 END) OR
        NEW.rules_version IS DISTINCT FROM 'purchase-v1' THEN
        RAISE EXCEPTION 'Historical purchase rate does not match prior purchase facts';
      END IF;
    ELSIF NEW.rate_percent IS DISTINCT FROM source_order.loyalty_rate_percent OR
      NEW.rules_version IS DISTINCT FROM source_order.loyalty_rate_version OR
      NEW.historical_version IS NOT NULL OR NEW.historical_spend_kopecks IS NOT NULL THEN
      RAISE EXCEPTION 'Loyalty purchase account does not match frozen checkout rate';
    END IF;
    PERFORM validate_order_pricing_snapshot(source_order);
    IF NEW.base_kopecks IS DISTINCT FROM (source_order.pricing_snapshot->>'itemsTotalKopecks')::NUMERIC THEN
      RAISE EXCEPTION 'Loyalty purchase base does not match checkout pricing';
    END IF;
    eligible_points := CASE WHEN (source_order.pricing_snapshot->>'loyaltyDiscountKopecks')::NUMERIC > 0 THEN 0
      ELSE ceil((NEW.base_kopecks-refunded)*NEW.rate_percent*5/10000) END;
    IF NEW.granted_points IS DISTINCT FROM eligible_points OR NEW.reversed_points <> 0 THEN
      RAISE EXCEPTION 'Loyalty purchase initial grant does not match net purchase';
    END IF;
  ELSE
    IF (NEW.order_id,NEW.member_id,NEW.rate_percent,NEW.rules_version,NEW.base_kopecks,
        NEW.granted_points,NEW.occurred_at,NEW.created_at,NEW.historical_version,NEW.historical_spend_kopecks) IS DISTINCT FROM
       (OLD.order_id,OLD.member_id,OLD.rate_percent,OLD.rules_version,OLD.base_kopecks,
        OLD.granted_points,OLD.occurred_at,OLD.created_at,OLD.historical_version,OLD.historical_spend_kopecks) THEN
      RAISE EXCEPTION 'Loyalty purchase grant identity is immutable';
    END IF;
    IF NEW.refunded_kopecks < OLD.refunded_kopecks OR NEW.reversed_points < OLD.reversed_points OR
      NEW.reversed_points IS DISTINCT FROM NEW.granted_points-least(NEW.granted_points,
        ceil((NEW.base_kopecks-refunded)*NEW.rate_percent*5/10000)) THEN
      RAISE EXCEPTION 'Loyalty purchase correction does not match remaining entitlement';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_loyalty_purchase_operation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  account loyalty_purchase_accounts%ROWTYPE;
  source_order orders%ROWTYPE;
  member_row loyalty_members%ROWTYPE;
  wallet loyalty_wallets%ROWTYPE;
  refunded NUMERIC;
  refund_time TIMESTAMP(3);
  expected_points NUMERIC;
BEGIN
  IF NEW.purchase_order_id IS NULL THEN
    IF NEW.operation_key LIKE 'purchase:%' OR NEW.source_key LIKE 'purchase:%' THEN
      RAISE EXCEPTION 'Purchase operation requires its structured source';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO source_order FROM orders WHERE id=NEW.purchase_order_id FOR UPDATE;
  SELECT * INTO account FROM loyalty_purchase_accounts WHERE order_id=NEW.purchase_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase operation account is missing'; END IF;
  SELECT * INTO member_row FROM loyalty_members WHERE id=account.member_id FOR UPDATE;
  IF NEW.member_id <> account.member_id OR NEW.source_key <> 'purchase:' || account.order_id OR
    NEW.rules_version <> account.rules_version OR source_order.user_id IS DISTINCT FROM member_row.user_id OR
    source_order.payment_status::text <> 'paid' OR source_order.paid_at IS NULL THEN
    RAISE EXCEPTION 'Purchase operation does not match source identity';
  END IF;
  IF NEW.kind::text = 'credit' THEN
    IF NEW.operation_key <> 'purchase:' || account.order_id || ':credit' OR
      NEW.requested_points <> account.granted_points OR NEW.occurred_at IS DISTINCT FROM account.occurred_at OR
      member_row.status::text <> 'active' OR NOT (member_row.history_state::text = 'ready' OR
        (member_row.history_state::text = 'pending' AND EXISTS (
          SELECT 1 FROM loyalty_purchase_history_syncs WHERE member_id=account.member_id
            AND active_transaction_id=txid_current()))) OR
      NOT EXISTS (SELECT 1 FROM users WHERE id=member_row.user_id AND status::text='active' AND deleted_at IS NULL) OR
      source_order.crm_status::text <> 'completed' OR source_order.completed_at IS NULL THEN
      RAISE EXCEPTION 'Purchase credit does not match initial grant';
    END IF;
  ELSIF NEW.kind::text = 'reversal' THEN
    SELECT coalesce(sum(r.total_kopecks-r.delivery_kopecks),0),max(r.created_at) INTO refunded,refund_time
      FROM order_refunds r JOIN order_refund_events e ON e.refund_id=r.id WHERE r.order_id=account.order_id;
    expected_points := account.granted_points-account.reversed_points-least(account.granted_points,
      ceil((account.base_kopecks-refunded)*account.rate_percent*5/10000));
    IF refunded <= account.refunded_kopecks OR refunded > account.base_kopecks OR
      NEW.requested_points IS DISTINCT FROM expected_points OR
      NEW.operation_key <> 'purchase:' || account.order_id || ':reversal:' || refunded::TEXT OR
      NEW.occurred_at IS DISTINCT FROM refund_time THEN
      RAISE EXCEPTION 'Purchase reversal does not match published refunds';
    END IF;
    SELECT * INTO wallet FROM loyalty_wallets WHERE member_id=account.member_id;
    IF NEW.balance_delta <> -least(NEW.requested_points,wallet.balance_points-wallet.reserved_points) THEN
      RAISE EXCEPTION 'Purchase reversal must cancel only available points';
    END IF;
  ELSE RAISE EXCEPTION 'Unsupported purchase operation'; END IF;
  RETURN NEW;
END;
$$;

COMMIT;
