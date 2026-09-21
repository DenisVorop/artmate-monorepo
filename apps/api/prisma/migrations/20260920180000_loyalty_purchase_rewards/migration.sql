BEGIN;

ALTER TABLE orders
  ADD COLUMN loyalty_rate_percent INTEGER,
  ADD COLUMN loyalty_rate_version VARCHAR(64),
  ADD CONSTRAINT orders_loyalty_rate_pair CHECK (
    (loyalty_rate_percent IS NULL AND loyalty_rate_version IS NULL) OR
    (loyalty_rate_percent IN (3,5,7,10) AND loyalty_rate_version = 'purchase-v1'
      AND loyalty_rate_percent IS NOT NULL AND loyalty_rate_version IS NOT NULL)
  );

CREATE FUNCTION guard_order_loyalty_rate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.loyalty_rate_percent IS DISTINCT FROM NEW.loyalty_rate_percent OR
      OLD.loyalty_rate_version IS DISTINCT FROM NEW.loyalty_rate_version) AND NOT (
    OLD.loyalty_rate_percent IS NULL AND OLD.loyalty_rate_version IS NULL AND
    OLD.pricing_snapshot IS NULL AND NEW.pricing_snapshot IS NOT NULL
  ) THEN RAISE EXCEPTION 'Checkout loyalty rate is immutable'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_loyalty_rate_guard BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_order_loyalty_rate();

CREATE TABLE loyalty_purchase_accounts (
  order_id VARCHAR(32) PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  member_id TEXT NOT NULL REFERENCES loyalty_members(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  rate_percent INTEGER NOT NULL CHECK (rate_percent IN (3,5,7,10)),
  rules_version VARCHAR(64) NOT NULL CHECK (rules_version = 'purchase-v1'),
  base_kopecks BIGINT NOT NULL CHECK (base_kopecks BETWEEN 0 AND 9007199254740991),
  granted_points BIGINT NOT NULL CHECK (granted_points BETWEEN 0 AND 9007199254740991),
  reversed_points BIGINT NOT NULL DEFAULT 0 CHECK (reversed_points BETWEEN 0 AND granted_points),
  refunded_kopecks BIGINT NOT NULL CHECK (refunded_kopecks BETWEEN 0 AND base_kopecks),
  occurred_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX loyalty_purchase_accounts_member_id_occurred_at_idx
  ON loyalty_purchase_accounts(member_id,occurred_at);

CREATE TABLE loyalty_purchase_syncs (
  order_id VARCHAR(32) PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX loyalty_purchase_syncs_next_attempt_at_idx ON loyalty_purchase_syncs(next_attempt_at);

ALTER TABLE loyalty_operations ADD COLUMN purchase_order_id VARCHAR(32)
  REFERENCES loyalty_purchase_accounts(order_id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE loyalty_operations ADD CONSTRAINT loyalty_operations_purchase_kind CHECK (
  purchase_order_id IS NULL OR (kind::text IN ('credit','reversal') AND reservation_id IS NULL AND refund_id IS NULL)
);
CREATE INDEX loyalty_operations_purchase_order_id_idx ON loyalty_operations(purchase_order_id);
CREATE UNIQUE INDEX loyalty_operations_purchase_credit_key ON loyalty_operations(purchase_order_id)
  WHERE kind = 'credit';

CREATE FUNCTION guard_loyalty_purchase_account() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source_order orders%ROWTYPE;
  member_row loyalty_members%ROWTYPE;
  refunded NUMERIC;
  eligible_points NUMERIC;
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
    IF source_order.user_id IS DISTINCT FROM member_row.user_id OR
      source_order.payment_status::text <> 'paid' OR source_order.paid_at IS NULL OR
      source_order.crm_status::text <> 'completed' OR source_order.completed_at IS NULL OR
      member_row.status::text <> 'active' OR member_row.history_state::text <> 'ready' OR
      NOT EXISTS (SELECT 1 FROM users WHERE id=member_row.user_id AND status::text='active' AND deleted_at IS NULL) OR
      NEW.rate_percent IS DISTINCT FROM source_order.loyalty_rate_percent OR
      NEW.rules_version IS DISTINCT FROM source_order.loyalty_rate_version OR
      NEW.occurred_at IS DISTINCT FROM greatest(source_order.paid_at,source_order.completed_at) OR
      source_order.pricing_snapshot IS NULL THEN
      RAISE EXCEPTION 'Loyalty purchase account requires an eligible completed paid order';
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
        NEW.granted_points,NEW.occurred_at,NEW.created_at) IS DISTINCT FROM
       (OLD.order_id,OLD.member_id,OLD.rate_percent,OLD.rules_version,OLD.base_kopecks,
        OLD.granted_points,OLD.occurred_at,OLD.created_at) THEN
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
CREATE TRIGGER loyalty_purchase_account_guard BEFORE INSERT OR UPDATE OR DELETE ON loyalty_purchase_accounts
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_purchase_account();

CREATE FUNCTION guard_loyalty_purchase_operation() RETURNS trigger LANGUAGE plpgsql AS $$
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
      member_row.status::text <> 'active' OR member_row.history_state::text <> 'ready' OR
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
CREATE TRIGGER loyalty_purchase_operation_guard BEFORE INSERT ON loyalty_operations
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_purchase_operation();

CREATE FUNCTION check_loyalty_purchase_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_order TEXT;
  account loyalty_purchase_accounts%ROWTYPE;
  credits BIGINT;
  granted NUMERIC;
  reversed NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'loyalty_operations' THEN target_order := NEW.purchase_order_id;
  ELSE target_order := NEW.order_id; END IF;
  IF target_order IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO account FROM loyalty_purchase_accounts WHERE order_id=target_order;
  SELECT count(*) FILTER (WHERE kind::text='credit'),
    coalesce(sum(requested_points) FILTER (WHERE kind::text='credit'),0),
    coalesce(sum(requested_points) FILTER (WHERE kind::text='reversal'),0)
    INTO credits,granted,reversed FROM loyalty_operations WHERE purchase_order_id=target_order;
  IF credits <> (CASE WHEN account.granted_points > 0 THEN 1 ELSE 0 END) OR
    granted <> account.granted_points OR reversed <> account.reversed_points THEN
    RAISE EXCEPTION 'Purchase account does not match its loyalty ledger';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER loyalty_purchase_account_ledger AFTER INSERT OR UPDATE ON loyalty_purchase_accounts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_purchase_ledger();
CREATE CONSTRAINT TRIGGER loyalty_purchase_operation_ledger AFTER INSERT ON loyalty_operations
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_loyalty_purchase_ledger();

COMMIT;
