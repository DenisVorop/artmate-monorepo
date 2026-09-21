BEGIN;

ALTER TYPE "loyalty_operation_kind" ADD VALUE 'restore';
ALTER TABLE "loyalty_operations"
  ADD COLUMN "refund_id" VARCHAR(32),
  ADD CONSTRAINT "loyalty_operations_refund_id_fkey" FOREIGN KEY ("refund_id")
    REFERENCES "order_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX "loyalty_operations_refund_id_key" ON "loyalty_operations"("refund_id");

-- Text comparisons allow installing guards in the transaction that adds the enum.
ALTER TABLE "loyalty_operations"
  DROP CONSTRAINT "loyalty_operations_kind_deltas",
  DROP CONSTRAINT "loyalty_operations_reservation_kind",
  ADD CONSTRAINT "loyalty_operations_kind_deltas" CHECK (
    (kind::text IN ('credit', 'restore') AND balance_delta = requested_points AND reserved_delta = 0) OR
    (kind::text = 'reversal' AND balance_delta BETWEEN -requested_points AND 0 AND reserved_delta = 0) OR
    (kind::text = 'reserve' AND balance_delta = 0 AND reserved_delta = requested_points) OR
    (kind::text = 'consume' AND balance_delta = -requested_points AND reserved_delta = -requested_points) OR
    (kind::text = 'release' AND balance_delta = 0 AND reserved_delta = -requested_points)
  ),
  ADD CONSTRAINT "loyalty_operations_reservation_kind" CHECK (
    (reservation_id IS NOT NULL) = (kind::text IN ('reserve', 'consume', 'release', 'restore'))
  ),
  ADD CONSTRAINT "loyalty_operations_refund_kind" CHECK (
    (refund_id IS NOT NULL) = (kind::text = 'restore')
  );

CREATE FUNCTION guard_loyalty_refund_restore() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  refund_row order_refunds%ROWTYPE;
  reservation_row loyalty_reservations%ROWTYPE;
  source_order orders%ROWTYPE;
  member_row loyalty_members%ROWTYPE;
  restored_points NUMERIC;
BEGIN
  IF NEW.kind::text <> 'restore' THEN RETURN NEW; END IF;
  SELECT * INTO refund_row FROM order_refunds WHERE id = NEW.refund_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty restore requires an existing refund'; END IF;
  SELECT * INTO source_order FROM orders WHERE id = refund_row.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty restore order is missing'; END IF;
  SELECT * INTO member_row FROM loyalty_members WHERE id = NEW.member_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty restore member is missing'; END IF;
  SELECT * INTO reservation_row FROM loyalty_reservations WHERE id = NEW.reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty restore reservation is missing'; END IF;
  IF reservation_row.order_id <> refund_row.order_id
    OR reservation_row.member_id <> NEW.member_id
    OR reservation_row.status::text <> 'consumed'
    OR source_order.checkout_actor_user_id IS DISTINCT FROM member_row.user_id
    OR source_order.payment_status::text <> 'paid' OR source_order.paid_at IS NULL
    OR refund_row.loyalty_points IS DISTINCT FROM NEW.requested_points
    OR NEW.operation_key <> 'refund:' || refund_row.id || ':restore'
    OR NEW.source_key <> 'refund:' || refund_row.id
    OR NEW.rules_version <> 'order-spend-v1'
    OR NEW.occurred_at IS DISTINCT FROM refund_row.created_at THEN
    RAISE EXCEPTION 'Loyalty restore does not match its completed refund';
  END IF;
  SELECT coalesce(sum(requested_points), 0) INTO restored_points
    FROM loyalty_operations WHERE reservation_id = NEW.reservation_id AND kind::text = 'restore';
  IF restored_points + NEW.requested_points > reservation_row.points THEN
    RAISE EXCEPTION 'Loyalty restores exceed originally consumed points';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "loyalty_refund_restore_guard" BEFORE INSERT ON "loyalty_operations"
  FOR EACH ROW EXECUTE FUNCTION guard_loyalty_refund_restore();

-- Preserve the existing whole-ledger invariant. RESTORE may cover only some of
-- a consumed reservation, unlike reserve/consume/release which use its full size.
CREATE OR REPLACE FUNCTION loyalty_check_accounting() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_member TEXT;
  wallet loyalty_wallets%ROWTYPE;
  operation_count BIGINT;
  last_sequence BIGINT;
  balance_sum NUMERIC;
  reserved_sum NUMERIC;
BEGIN
  target_member := CASE WHEN TG_OP = 'DELETE' THEN OLD.member_id ELSE NEW.member_id END;
  IF TG_OP = 'UPDATE' AND OLD.member_id <> NEW.member_id THEN
    RAISE EXCEPTION 'Loyalty accounting member is immutable';
  END IF;
  SELECT * INTO wallet FROM loyalty_wallets WHERE member_id = target_member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Loyalty accounting requires a wallet'; END IF;
  SELECT count(*), coalesce(max(sequence), 0), coalesce(sum(balance_delta), 0), coalesce(sum(reserved_delta), 0)
    INTO operation_count, last_sequence, balance_sum, reserved_sum
    FROM loyalty_operations WHERE member_id = target_member;
  IF wallet.balance_points <> balance_sum OR wallet.reserved_points <> reserved_sum OR
    wallet.revision <> operation_count OR last_sequence <> operation_count THEN
    RAISE EXCEPTION 'Loyalty wallet does not match its ledger';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (
      SELECT balance_after, reserved_after,
        sum(balance_delta) OVER (ORDER BY sequence) AS running_balance,
        sum(reserved_delta) OVER (ORDER BY sequence) AS running_reserved
      FROM loyalty_operations WHERE member_id = target_member
    ) history WHERE balance_after <> running_balance OR reserved_after <> running_reserved
  ) THEN RAISE EXCEPTION 'Loyalty operation balances do not match ledger sequence'; END IF;
  IF EXISTS (
    SELECT 1 FROM loyalty_operations o JOIN loyalty_reservations r ON r.id = o.reservation_id
    WHERE o.member_id = target_member AND (
      r.member_id <> o.member_id OR (o.kind::text <> 'restore' AND r.points <> o.requested_points)
    )
  ) THEN RAISE EXCEPTION 'Loyalty operation does not match its reservation'; END IF;
  IF EXISTS (
    SELECT 1 FROM loyalty_reservations r
    LEFT JOIN loyalty_operations o ON o.reservation_id = r.id
    WHERE r.member_id = target_member
    GROUP BY r.id, r.status
    HAVING count(*) FILTER (WHERE o.kind::text = 'reserve') <> 1 OR
      count(*) FILTER (WHERE o.kind::text = 'consume') <> CASE WHEN r.status::text = 'consumed' THEN 1 ELSE 0 END OR
      count(*) FILTER (WHERE o.kind::text = 'release') <> CASE WHEN r.status::text = 'released' THEN 1 ELSE 0 END OR
      min(o.sequence) FILTER (WHERE o.kind::text = 'reserve') > min(o.sequence) FILTER (WHERE o.kind::text IN ('consume', 'release')) OR
      coalesce(sum(o.requested_points) FILTER (WHERE o.kind::text = 'restore'), 0) > r.points OR
      (count(*) FILTER (WHERE o.kind::text = 'restore') > 0 AND (
        r.status::text <> 'consumed' OR min(o.sequence) FILTER (WHERE o.kind::text = 'restore') <= min(o.sequence) FILTER (WHERE o.kind::text = 'consume')
      ))
  ) THEN RAISE EXCEPTION 'Loyalty reservation status does not match its ledger'; END IF;
  RETURN NULL;
END;
$$;

COMMIT;
