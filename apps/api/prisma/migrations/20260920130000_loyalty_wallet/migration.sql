BEGIN;

CREATE TYPE "loyalty_member_status" AS ENUM ('active', 'blocked');
CREATE TYPE "loyalty_history_state" AS ENUM ('pending', 'ready', 'failed');
CREATE TYPE "loyalty_operation_kind" AS ENUM ('credit', 'reversal', 'reserve', 'consume', 'release');
CREATE TYPE "loyalty_reservation_status" AS ENUM ('reserved', 'consumed', 'released');

CREATE TABLE "loyalty_members" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "terms_version" VARCHAR(64) NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "loyalty_member_status" NOT NULL DEFAULT 'active',
  "history_state" "loyalty_history_state" NOT NULL DEFAULT 'pending',
  CONSTRAINT "loyalty_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "loyalty_members_user_id_key" ON "loyalty_members"("user_id");
CREATE INDEX "loyalty_members_history_state_joined_at_idx" ON "loyalty_members"("history_state", "joined_at");

CREATE TABLE "loyalty_wallets" (
  "member_id" TEXT NOT NULL,
  "balance_points" BIGINT NOT NULL DEFAULT 0,
  "reserved_points" BIGINT NOT NULL DEFAULT 0,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_wallets_pkey" PRIMARY KEY ("member_id"),
  CONSTRAINT "loyalty_wallets_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_wallets_bounds" CHECK (
    balance_points BETWEEN 0 AND 9007199254740991 AND
    reserved_points BETWEEN 0 AND balance_points AND
    revision BETWEEN 0 AND 9007199254740991
  )
);

CREATE TABLE "loyalty_reservations" (
  "id" TEXT NOT NULL,
  "order_id" VARCHAR(32) NOT NULL,
  "member_id" TEXT NOT NULL,
  "points" BIGINT NOT NULL,
  "status" "loyalty_reservation_status" NOT NULL DEFAULT 'reserved',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_reservations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_reservations_points_bounds" CHECK (points BETWEEN 1 AND 9007199254740991)
);
CREATE UNIQUE INDEX "loyalty_reservations_order_id_key" ON "loyalty_reservations"("order_id");
CREATE INDEX "loyalty_reservations_member_id_status_idx" ON "loyalty_reservations"("member_id", "status");

CREATE TABLE "loyalty_operations" (
  "id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "sequence" BIGINT NOT NULL,
  "operation_key" VARCHAR(200) NOT NULL,
  "kind" "loyalty_operation_kind" NOT NULL,
  "requested_points" BIGINT NOT NULL,
  "balance_delta" BIGINT NOT NULL,
  "reserved_delta" BIGINT NOT NULL,
  "balance_after" BIGINT NOT NULL,
  "reserved_after" BIGINT NOT NULL,
  "source_key" VARCHAR(200) NOT NULL,
  "rules_version" VARCHAR(64) NOT NULL,
  "reservation_id" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_operations_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "loyalty_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_operations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "loyalty_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "loyalty_operations_bounds" CHECK (
    sequence BETWEEN 1 AND 9007199254740991 AND
    requested_points BETWEEN 1 AND 9007199254740991 AND
    balance_delta BETWEEN -9007199254740991 AND 9007199254740991 AND
    reserved_delta BETWEEN -9007199254740991 AND 9007199254740991 AND
    balance_after BETWEEN 0 AND 9007199254740991 AND
    reserved_after BETWEEN 0 AND balance_after
  ),
  CONSTRAINT "loyalty_operations_kind_deltas" CHECK (
    (kind = 'credit' AND balance_delta = requested_points AND reserved_delta = 0) OR
    (kind = 'reversal' AND balance_delta BETWEEN -requested_points AND 0 AND reserved_delta = 0) OR
    (kind = 'reserve' AND balance_delta = 0 AND reserved_delta = requested_points) OR
    (kind = 'consume' AND balance_delta = -requested_points AND reserved_delta = -requested_points) OR
    (kind = 'release' AND balance_delta = 0 AND reserved_delta = -requested_points)
  ),
  CONSTRAINT "loyalty_operations_reservation_kind" CHECK (
    (reservation_id IS NOT NULL) = (kind IN ('reserve', 'consume', 'release'))
  )
);
CREATE UNIQUE INDEX "loyalty_operations_operation_key_key" ON "loyalty_operations"("operation_key");
CREATE UNIQUE INDEX "loyalty_operations_member_id_sequence_key" ON "loyalty_operations"("member_id", "sequence");
CREATE INDEX "loyalty_operations_member_id_source_key_idx" ON "loyalty_operations"("member_id", "source_key");

CREATE FUNCTION loyalty_operation_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Loyalty operations are append-only';
END;
$$;
CREATE TRIGGER loyalty_operation_immutable BEFORE UPDATE OR DELETE ON loyalty_operations
FOR EACH ROW EXECUTE FUNCTION loyalty_operation_immutable();

CREATE FUNCTION loyalty_reservation_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Loyalty reservations cannot be deleted';
  END IF;
  IF (NEW.id, NEW.order_id, NEW.member_id, NEW.points, NEW.created_at)
     IS DISTINCT FROM (OLD.id, OLD.order_id, OLD.member_id, OLD.points, OLD.created_at) THEN
    RAISE EXCEPTION 'Loyalty reservation identity and points are immutable';
  END IF;
  IF NEW.status <> OLD.status AND NOT (
    OLD.status = 'reserved' AND NEW.status IN ('consumed', 'released')
  ) THEN
    RAISE EXCEPTION 'Invalid loyalty reservation transition';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER loyalty_reservation_guard BEFORE UPDATE OR DELETE ON loyalty_reservations
FOR EACH ROW EXECUTE FUNCTION loyalty_reservation_guard();

-- Service writes wallet, operations and reservations in one transaction under a
-- wallet row lock. Check the final committed state, not intermediate statements.
CREATE FUNCTION loyalty_check_accounting() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loyalty accounting requires a wallet';
  END IF;

  SELECT count(*), coalesce(max(sequence), 0),
    coalesce(sum(balance_delta), 0), coalesce(sum(reserved_delta), 0)
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
  ) THEN
    RAISE EXCEPTION 'Loyalty operation balances do not match ledger sequence';
  END IF;

  IF EXISTS (
    SELECT 1 FROM loyalty_operations o JOIN loyalty_reservations r ON r.id = o.reservation_id
    WHERE o.member_id = target_member AND (r.member_id <> o.member_id OR r.points <> o.requested_points)
  ) THEN
    RAISE EXCEPTION 'Loyalty operation does not match its reservation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM loyalty_reservations r
    LEFT JOIN loyalty_operations o ON o.reservation_id = r.id
    WHERE r.member_id = target_member
    GROUP BY r.id, r.status
    HAVING count(*) FILTER (WHERE o.kind = 'reserve') <> 1 OR
      count(*) FILTER (WHERE o.kind = 'consume') <> CASE WHEN r.status = 'consumed' THEN 1 ELSE 0 END OR
      count(*) FILTER (WHERE o.kind = 'release') <> CASE WHEN r.status = 'released' THEN 1 ELSE 0 END OR
      min(o.sequence) FILTER (WHERE o.kind = 'reserve') >
        min(o.sequence) FILTER (WHERE o.kind IN ('consume', 'release'))
  ) THEN
    RAISE EXCEPTION 'Loyalty reservation status does not match its ledger';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER loyalty_wallet_accounting
AFTER INSERT OR UPDATE OR DELETE ON loyalty_wallets DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION loyalty_check_accounting();
CREATE CONSTRAINT TRIGGER loyalty_operation_accounting
AFTER INSERT ON loyalty_operations DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION loyalty_check_accounting();
CREATE CONSTRAINT TRIGGER loyalty_reservation_accounting
AFTER INSERT OR UPDATE ON loyalty_reservations DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION loyalty_check_accounting();

COMMIT;
