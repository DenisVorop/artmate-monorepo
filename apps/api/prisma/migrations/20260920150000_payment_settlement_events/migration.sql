BEGIN;

ALTER TYPE "order_payment_status" ADD VALUE 'closed_unpaid';
ALTER TABLE "orders" ADD COLUMN "payment_closed_unpaid_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD CONSTRAINT "orders_closed_unpaid_state_check" CHECK (
  "payment_status"::text <> 'closed_unpaid'
  OR ("payment_closed_unpaid_at" IS NOT NULL AND "paid_at" IS NULL)
);

CREATE TYPE "order_payment_event_kind" AS ENUM ('paid', 'closed_unpaid');
CREATE TABLE "order_payment_events" (
  "id" TEXT PRIMARY KEY,
  "order_id" VARCHAR(32) NOT NULL REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" "order_payment_event_kind" NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_payment_events_order_id_kind_key" UNIQUE ("order_id", "kind")
);
CREATE INDEX "order_payment_events_created_at_id_idx" ON "order_payment_events"("created_at", "id");

CREATE TABLE "loyalty_payment_receipts" (
  "event_id" TEXT PRIMARY KEY REFERENCES "order_payment_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "processed_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error" VARCHAR(80),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "loyalty_payment_receipts_processed_at_next_attempt_at_idx"
  ON "loyalty_payment_receipts"("processed_at", "next_attempt_at");

CREATE FUNCTION guard_order_payment_event_fact() RETURNS trigger AS $$
DECLARE
  source_order orders%ROWTYPE;
BEGIN
  SELECT * INTO source_order FROM orders WHERE id = NEW.order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order payment event source is missing'; END IF;
  IF NEW.kind::text = 'paid' THEN
    IF source_order.payment_status::text <> 'paid'
      OR source_order.paid_at IS NULL
      OR source_order.paid_at IS DISTINCT FROM NEW.occurred_at THEN
      RAISE EXCEPTION 'Order payment event does not match paid source fact';
    END IF;
  ELSE
    IF source_order.payment_status::text <> 'closed_unpaid'
      OR source_order.paid_at IS NOT NULL
      OR source_order.payment_closed_unpaid_at IS NULL
      OR source_order.payment_closed_unpaid_at IS DISTINCT FROM NEW.occurred_at THEN
      RAISE EXCEPTION 'Order payment event does not match closed unpaid source fact';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "order_payment_events_source_fact" BEFORE INSERT ON "order_payment_events"
  FOR EACH ROW EXECUTE FUNCTION guard_order_payment_event_fact();

-- Only an already recorded payment fact is safe to backfill. FAILED is not a
-- provider-neutral final closure and must never release a loyalty reservation.
INSERT INTO "order_payment_events" ("id", "order_id", "kind", "occurred_at")
SELECT 'backfill-paid-' || "id", "id", 'paid', "paid_at"
FROM "orders" WHERE "payment_status"::text = 'paid' AND "paid_at" IS NOT NULL;

CREATE FUNCTION guard_order_payment_event() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Order payment events are immutable';
  END IF;
  IF OLD IS DISTINCT FROM NEW THEN
    RAISE EXCEPTION 'Order payment events are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "order_payment_events_immutable" BEFORE UPDATE OR DELETE ON "order_payment_events"
  FOR EACH ROW EXECUTE FUNCTION guard_order_payment_event();

COMMIT;
