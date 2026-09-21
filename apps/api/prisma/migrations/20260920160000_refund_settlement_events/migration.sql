BEGIN;

LOCK TABLE orders, order_refunds, order_refund_items IN ACCESS EXCLUSIVE MODE;
ALTER TABLE order_refunds ADD COLUMN loyalty_points BIGINT;
ALTER TABLE order_refund_items ADD COLUMN previous_quantity INTEGER;
ALTER TABLE order_refund_items ADD COLUMN loyalty_points BIGINT;
ALTER TABLE order_refunds DISABLE TRIGGER order_refunds_immutable;
ALTER TABLE order_refund_items DISABLE TRIGGER order_refund_items_immutable;

-- Keep the original price-group order. Money and points cover the same units.
CREATE FUNCTION order_refund_allocation(pricing JSONB, product TEXT, previous BIGINT, requested BIGINT)
RETURNS TABLE (cash BIGINT, points BIGINT) LANGUAGE plpgsql AS $$
DECLARE
  item JSONB;
  price_group JSONB;
  group_start NUMERIC := 0;
  group_quantity NUMERIC;
  taken NUMERIC;
  cash_sum NUMERIC := 0;
  points_sum NUMERIC := 0;
BEGIN
  IF previous < 0 OR requested <= 0 OR previous IS NULL OR requested IS NULL THEN
    RAISE EXCEPTION 'Invalid refund quantity range';
  END IF;
  IF jsonb_typeof(pricing->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Refund requires order pricing items';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(pricing->'items') value WHERE value->>'id' = product) <> 1 THEN
    RAISE EXCEPTION 'Refund product does not match order pricing';
  END IF;
  SELECT value INTO item FROM jsonb_array_elements(pricing->'items') value WHERE value->>'id' = product;
  IF jsonb_typeof(item->'priceGroups') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Refund requires order price groups';
  END IF;
  FOR price_group IN SELECT value FROM jsonb_array_elements(item->'priceGroups') LOOP
    group_quantity := order_pricing_uint(price_group->'quantity', 'Refund group quantity', true);
    taken := greatest(0, least(group_start + group_quantity, previous::numeric + requested) - greatest(group_start, previous));
    cash_sum := cash_sum + taken * order_pricing_uint(price_group->'unitPriceKopecks', 'Refund cash');
    points_sum := points_sum + taken * order_pricing_uint(price_group->'loyaltyPointsPerUnit', 'Refund points');
    group_start := group_start + group_quantity;
  END LOOP;
  IF previous::numeric + requested > group_start THEN
    RAISE EXCEPTION 'Refund quantity exceeds purchased quantity';
  END IF;
  IF cash_sum > 9007199254740991 OR points_sum > 9007199254740991 THEN
    RAISE EXCEPTION 'Refund allocation exceeds safe integer range';
  END IF;
  RETURN QUERY SELECT cash_sum::bigint, points_sum::bigint;
END;
$$;

DO $$
DECLARE
  source_order orders%ROWTYPE;
  source_item RECORD;
  allocation RECORD;
BEGIN
  FOR source_order IN SELECT * FROM orders WHERE id IN (SELECT order_id FROM order_refunds) LOOP
    PERFORM validate_order_pricing_snapshot(source_order);
    -- created_at is transaction start, not lock-acquisition order. Do not invent
    -- historical unit allocation when multiple refunds could have different points.
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(source_order.pricing_snapshot->'items') item
      WHERE (SELECT count(*) FROM order_refund_items ri JOIN order_refunds r ON r.id = ri.refund_id
        WHERE r.order_id = source_order.id AND ri.product_id = item->>'id') > 1
      AND (SELECT count(DISTINCT g->>'loyaltyPointsPerUnit') FROM jsonb_array_elements(item->'priceGroups') g) > 1
    ) THEN
      RAISE EXCEPTION 'Historical loyalty refund allocation requires reconciliation for order %', source_order.id;
    END IF;
  END LOOP;
  FOR source_item IN
    SELECT ri.*, o.pricing_snapshot,
      coalesce(sum(ri.quantity) OVER (PARTITION BY r.order_id, ri.product_id ORDER BY r.created_at, r.id
        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)::bigint AS prior
    FROM order_refund_items ri JOIN order_refunds r ON r.id = ri.refund_id JOIN orders o ON o.id = r.order_id
  LOOP
    SELECT * INTO allocation FROM order_refund_allocation(source_item.pricing_snapshot, source_item.product_id, source_item.prior, source_item.quantity);
    IF allocation.cash IS DISTINCT FROM source_item.amount_kopecks THEN
      RAISE EXCEPTION 'Historical refund cash does not match pricing for refund %', source_item.refund_id;
    END IF;
    UPDATE order_refund_items SET previous_quantity = source_item.prior, loyalty_points = allocation.points
      WHERE refund_id = source_item.refund_id AND product_id = source_item.product_id;
  END LOOP;
  UPDATE order_refunds r SET loyalty_points =
    (SELECT coalesce(sum(i.loyalty_points), 0) FROM order_refund_items i WHERE i.refund_id = r.id);
END;
$$;

ALTER TABLE order_refunds ALTER COLUMN loyalty_points SET NOT NULL;
ALTER TABLE order_refunds ADD CONSTRAINT order_refunds_loyalty_points_check CHECK (loyalty_points BETWEEN 0 AND 9007199254740991);
ALTER TABLE order_refund_items ALTER COLUMN previous_quantity SET NOT NULL;
ALTER TABLE order_refund_items ALTER COLUMN loyalty_points SET NOT NULL;
ALTER TABLE order_refund_items ADD CONSTRAINT order_refund_items_loyalty_check
  CHECK (previous_quantity >= 0 AND loyalty_points BETWEEN 0 AND 9007199254740991);
ALTER TABLE order_refunds ENABLE TRIGGER order_refunds_immutable;
ALTER TABLE order_refund_items ENABLE TRIGGER order_refund_items_immutable;

CREATE TABLE order_refund_events (
  id TEXT PRIMARY KEY,
  refund_id VARCHAR(32) NOT NULL UNIQUE REFERENCES order_refunds(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  occurred_at TIMESTAMP(3) NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX order_refund_events_created_at_id_idx ON order_refund_events(created_at, id);
CREATE TABLE loyalty_refund_receipts (
  event_id TEXT PRIMARY KEY REFERENCES order_refund_events(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  processed_at TIMESTAMP(3),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(80),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX loyalty_refund_receipts_processed_at_next_attempt_at_idx ON loyalty_refund_receipts(processed_at, next_attempt_at);

CREATE FUNCTION validate_recorded_refund(refund_key TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  refund order_refunds%ROWTYPE;
  source_order orders%ROWTYPE;
  item order_refund_items%ROWTYPE;
  allocation RECORD;
  cash_sum NUMERIC := 0;
  points_sum NUMERIC := 0;
BEGIN
  SELECT * INTO refund FROM order_refunds WHERE id = refund_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund source is missing'; END IF;
  SELECT * INTO source_order FROM orders WHERE id = refund.order_id FOR UPDATE;
  IF NOT FOUND OR source_order.payment_status::text <> 'paid' OR source_order.paid_at IS NULL THEN
    RAISE EXCEPTION 'Recorded refund requires paid order';
  END IF;
  PERFORM validate_order_pricing_snapshot(source_order);
  FOR item IN SELECT * FROM order_refund_items WHERE refund_id = refund.id LOOP
    SELECT * INTO allocation FROM order_refund_allocation(source_order.pricing_snapshot, item.product_id, item.previous_quantity, item.quantity);
    IF item.amount_kopecks IS DISTINCT FROM allocation.cash OR item.loyalty_points IS DISTINCT FROM allocation.points THEN
      RAISE EXCEPTION 'Refund item does not match pricing allocation';
    END IF;
    cash_sum := cash_sum + item.amount_kopecks;
    points_sum := points_sum + item.loyalty_points;
    IF EXISTS (
      SELECT 1 FROM (
        SELECT i.previous_quantity, coalesce(sum(i.quantity) OVER (ORDER BY i.previous_quantity, i.refund_id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS expected
        FROM order_refund_items i JOIN order_refunds r ON r.id = i.refund_id
        WHERE r.order_id = source_order.id AND i.product_id = item.product_id
      ) ranges WHERE previous_quantity <> expected
    ) THEN RAISE EXCEPTION 'Refund unit ranges overlap or contain gaps'; END IF;
  END LOOP;
  IF refund.loyalty_points <> points_sum OR refund.total_kopecks <> cash_sum + refund.delivery_kopecks THEN
    RAISE EXCEPTION 'Refund totals do not match item allocation';
  END IF;
  IF (SELECT sum(delivery_kopecks) FROM order_refunds WHERE order_id = source_order.id) > source_order.delivery_price * 100 THEN
    RAISE EXCEPTION 'Refund delivery exceeds paid amount';
  END IF;
END;
$$;

CREATE FUNCTION guard_order_refund_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Order refund events are immutable'; END IF;
  PERFORM validate_recorded_refund(NEW.refund_id);
  IF NOT EXISTS (SELECT 1 FROM order_refunds WHERE id = NEW.refund_id AND created_at = NEW.occurred_at) THEN
    RAISE EXCEPTION 'Refund event timestamp does not match source';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_refund_events_source_guard BEFORE INSERT OR UPDATE OR DELETE ON order_refund_events
  FOR EACH ROW EXECUTE FUNCTION guard_order_refund_event();

-- Replay confirmed historical records through the same consumer, never credit
-- the wallet inside a schema migration.
INSERT INTO order_refund_events (id, refund_id, occurred_at)
  SELECT 'backfill-refund-' || id, id, created_at FROM order_refunds;

CREATE FUNCTION guard_refund_item_append() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_order_id TEXT;
BEGIN
  SELECT order_id INTO source_order_id FROM order_refunds WHERE id = NEW.refund_id;
  PERFORM id FROM orders WHERE id = source_order_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM order_refund_events WHERE refund_id = NEW.refund_id) THEN
    RAISE EXCEPTION 'Published refund items are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER order_refund_items_append_guard BEFORE INSERT ON order_refund_items
  FOR EACH ROW EXECUTE FUNCTION guard_refund_item_append();

CREATE FUNCTION check_refund_publication() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target TEXT;
BEGIN
  IF TG_TABLE_NAME = 'order_refunds' THEN target := NEW.id;
  ELSE target := NEW.refund_id;
  END IF;
  PERFORM validate_recorded_refund(target);
  IF NOT EXISTS (SELECT 1 FROM order_refund_events WHERE refund_id = target) THEN
    RAISE EXCEPTION 'Recorded refund requires durable event';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER order_refunds_publication AFTER INSERT ON order_refunds
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_refund_publication();
CREATE CONSTRAINT TRIGGER order_refund_items_publication AFTER INSERT ON order_refund_items
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_refund_publication();

COMMIT;
