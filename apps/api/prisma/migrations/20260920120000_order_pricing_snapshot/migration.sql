-- A malformed historical order aborts the entire schema change and backfill.
BEGIN;

ALTER TABLE "orders" ADD COLUMN "pricing_snapshot" JSONB;
LOCK TABLE "order_items" IN SHARE MODE;

CREATE FUNCTION order_pricing_uint(value JSONB, label TEXT, positive BOOLEAN DEFAULT false)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result NUMERIC;
BEGIN
  IF jsonb_typeof(value) IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot: % must be a number', label;
  END IF;
  result := value::text::numeric;
  IF result < 0 OR result > 9007199254740991 OR trunc(result) <> result
    OR (positive AND result = 0) THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot: % must be a safe nonnegative integer', label;
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION validate_order_pricing_snapshot(order_row "orders")
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  snapshot JSONB := order_row.pricing_snapshot;
  item JSONB;
  price_group JSONB;
  stored_item RECORD;
  field_name TEXT;
  seen_ids TEXT[] := ARRAY[]::TEXT[];
  item_id TEXT;
  unit_price NUMERIC;
  quantity NUMERIC;
  group_quantity NUMERIC;
  group_price NUMERIC;
  group_count NUMERIC;
  group_total NUMERIC;
  group_discount NUMERIC;
  group_loyalty_points NUMERIC;
  sum_subtotal NUMERIC := 0;
  sum_discount NUMERIC := 0;
  sum_loyalty_discount NUMERIC := 0;
  sum_total NUMERIC := 0;
BEGIN
  IF jsonb_typeof(snapshot) IS DISTINCT FROM 'object'
    OR snapshot->'version' IS DISTINCT FROM '1'::jsonb
    OR snapshot->'currency' IS DISTINCT FROM '"RUB"'::jsonb
    OR order_row.currency IS DISTINCT FROM 'RUB'
    OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot for order %: shape/currency', order_row.id;
  END IF;

  IF (SELECT count(*) FROM jsonb_object_keys(snapshot)) <> 10 THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot for order %: unexpected fields', order_row.id;
  END IF;

  FOREACH field_name IN ARRAY ARRAY['subtotalKopecks', 'promoDiscountKopecks',
    'loyaltyDiscountKopecks', 'discountKopecks', 'itemsTotalKopecks', 'deliveryKopecks', 'totalKopecks'] LOOP
    PERFORM order_pricing_uint(snapshot->field_name, field_name);
  END LOOP;
  IF (snapshot->>'subtotalKopecks')::numeric IS DISTINCT FROM order_row.subtotal * 100
    OR (snapshot->>'discountKopecks')::numeric IS DISTINCT FROM order_row.discount * 100
    OR (snapshot->>'promoDiscountKopecks')::numeric + (snapshot->>'loyaltyDiscountKopecks')::numeric <> (snapshot->>'discountKopecks')::numeric
    OR (snapshot->>'deliveryKopecks')::numeric IS DISTINCT FROM order_row.delivery_price * 100
    OR (snapshot->>'totalKopecks')::numeric IS DISTINCT FROM order_row.total * 100
    OR (snapshot->>'subtotalKopecks')::numeric <> (snapshot->>'discountKopecks')::numeric + (snapshot->>'itemsTotalKopecks')::numeric
    OR (snapshot->>'totalKopecks')::numeric <> (snapshot->>'itemsTotalKopecks')::numeric + (snapshot->>'deliveryKopecks')::numeric THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot for order %: order totals', order_row.id;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'items') LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
      OR btrim(item->>'id') = ''
      OR jsonb_typeof(item->'priceGroups') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: item shape', order_row.id;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(item)) <> 9 THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: unexpected item fields', order_row.id;
    END IF;
    item_id := item->>'id';
    IF item_id = ANY(seen_ids) THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: duplicate item %', order_row.id, item_id;
    END IF;
    seen_ids := array_append(seen_ids, item_id);
    SELECT * INTO stored_item FROM "order_items"
      WHERE order_id = order_row.id AND product_id = item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: unknown item %', order_row.id, item_id;
    END IF;
    unit_price := order_pricing_uint(item->'unitPriceKopecks', 'item.unitPriceKopecks');
    quantity := order_pricing_uint(item->'quantity', 'item.quantity', true);
    FOREACH field_name IN ARRAY ARRAY['subtotalKopecks', 'promoDiscountKopecks',
      'loyaltyPoints', 'loyaltyDiscountKopecks', 'totalKopecks'] LOOP
      PERFORM order_pricing_uint(item->field_name, 'item.' || field_name);
    END LOOP;
    IF unit_price IS DISTINCT FROM stored_item.price * 100
      OR quantity IS DISTINCT FROM stored_item.quantity::numeric
      OR unit_price * quantity IS DISTINCT FROM stored_item.line_total * 100
      OR (item->>'subtotalKopecks')::numeric <> unit_price * quantity
      OR (item->>'loyaltyDiscountKopecks')::numeric <> (item->>'loyaltyPoints')::numeric * 20
      OR (item->>'subtotalKopecks')::numeric <> (item->>'promoDiscountKopecks')::numeric + (item->>'loyaltyDiscountKopecks')::numeric + (item->>'totalKopecks')::numeric THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: item amounts %', order_row.id, item_id;
    END IF;
    group_count := 0;
    group_total := 0;
    group_discount := 0;
    group_loyalty_points := 0;
    FOR price_group IN SELECT value FROM jsonb_array_elements(item->'priceGroups') LOOP
      IF jsonb_typeof(price_group) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: group shape', order_row.id;
      END IF;
      IF (SELECT count(*) FROM jsonb_object_keys(price_group)) <> 5 THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: unexpected group fields', order_row.id;
      END IF;
      group_quantity := order_pricing_uint(price_group->'quantity', 'group.quantity', true);
      group_price := order_pricing_uint(price_group->'unitPriceKopecks', 'group.unitPriceKopecks');
      PERFORM order_pricing_uint(price_group->'totalKopecks', 'group.totalKopecks');
      PERFORM order_pricing_uint(price_group->'promoDiscountPerUnitKopecks', 'group.promoDiscountPerUnitKopecks');
      PERFORM order_pricing_uint(price_group->'loyaltyPointsPerUnit', 'group.loyaltyPointsPerUnit');
      IF group_price > unit_price
        OR (price_group->>'totalKopecks')::numeric <> group_price * group_quantity
        OR (price_group->>'promoDiscountPerUnitKopecks')::numeric + (price_group->>'loyaltyPointsPerUnit')::numeric * 20 <> unit_price - group_price THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: group amounts %', order_row.id, item_id;
      END IF;
      group_count := group_count + group_quantity;
      group_total := group_total + group_price * group_quantity;
      group_discount := group_discount + (price_group->>'promoDiscountPerUnitKopecks')::numeric * group_quantity;
      group_loyalty_points := group_loyalty_points + (price_group->>'loyaltyPointsPerUnit')::numeric * group_quantity;
    END LOOP;
    IF group_count <> quantity OR group_total <> (item->>'totalKopecks')::numeric
      OR group_discount <> (item->>'promoDiscountKopecks')::numeric
      OR group_loyalty_points <> (item->>'loyaltyPoints')::numeric THEN
      RAISE EXCEPTION 'Invalid order pricing snapshot for order %: group sums %', order_row.id, item_id;
    END IF;
    sum_subtotal := sum_subtotal + (item->>'subtotalKopecks')::numeric;
    sum_discount := sum_discount + (item->>'promoDiscountKopecks')::numeric;
    sum_loyalty_discount := sum_loyalty_discount + (item->>'loyaltyDiscountKopecks')::numeric;
    sum_total := sum_total + (item->>'totalKopecks')::numeric;
  END LOOP;
  IF cardinality(seen_ids) = 0
    OR cardinality(seen_ids) <> (SELECT count(*) FROM "order_items" WHERE order_id = order_row.id)
    OR sum_subtotal <> (snapshot->>'subtotalKopecks')::numeric
    OR sum_discount <> (snapshot->>'promoDiscountKopecks')::numeric
    OR sum_loyalty_discount <> (snapshot->>'loyaltyDiscountKopecks')::numeric
    OR sum_total <> (snapshot->>'itemsTotalKopecks')::numeric THEN
    RAISE EXCEPTION 'Invalid order pricing snapshot for order %: item sums or missing items', order_row.id;
  END IF;
END;
$$;

DO $$
DECLARE
  order_row "orders";
  source JSONB;
  item JSONB;
  price_group JSONB;
  items JSONB;
  groups JSONB;
  unit_price NUMERIC;
BEGIN
  FOR order_row IN SELECT * FROM "orders" ORDER BY id LOOP
    IF order_row.promo_code IS NOT NULL THEN
      source := order_row.promo_pricing_snapshot;
      IF jsonb_typeof(source) IS DISTINCT FROM 'object'
        OR jsonb_typeof(source->'items') IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: legacy promo shape', order_row.id;
      END IF;
      IF order_pricing_uint(source->'subtotalKopecks', 'legacy.subtotalKopecks') IS DISTINCT FROM order_row.subtotal * 100
        OR order_pricing_uint(source->'discountKopecks', 'legacy.discountKopecks') IS DISTINCT FROM order_row.discount * 100
        OR order_pricing_uint(source->'totalKopecks', 'legacy.totalKopecks') IS DISTINCT FROM (order_row.subtotal - order_row.discount) * 100 THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: legacy promo totals', order_row.id;
      END IF;
      items := '[]'::jsonb;
      -- Preserve the original item and group array order: refunds allocate by it.
      FOR item IN SELECT value FROM jsonb_array_elements(source->'items') LOOP
        unit_price := order_pricing_uint(item->'unitPriceKopecks', 'legacy.item.unitPriceKopecks');
        IF jsonb_typeof(item->'priceGroups') IS DISTINCT FROM 'array' THEN
          RAISE EXCEPTION 'Invalid order pricing snapshot for order %: legacy groups', order_row.id;
        END IF;
        groups := '[]'::jsonb;
        FOR price_group IN SELECT value FROM jsonb_array_elements(item->'priceGroups') LOOP
          groups := groups || jsonb_build_array(jsonb_build_object(
            'quantity', price_group->'quantity',
            'unitPriceKopecks', price_group->'unitPriceKopecks',
            'promoDiscountPerUnitKopecks', unit_price - order_pricing_uint(price_group->'unitPriceKopecks', 'legacy.group.unitPriceKopecks'),
            'loyaltyPointsPerUnit', 0,
            'totalKopecks', price_group->'totalKopecks'));
        END LOOP;
        items := items || jsonb_build_array(jsonb_build_object(
          'id', item->'id', 'unitPriceKopecks', item->'unitPriceKopecks', 'quantity', item->'quantity',
          'subtotalKopecks', item->'subtotalKopecks', 'promoDiscountKopecks', item->'discountKopecks',
          'loyaltyPoints', 0, 'loyaltyDiscountKopecks', 0,
          'totalKopecks', item->'totalKopecks', 'priceGroups', groups));
      END LOOP;
    ELSE
      IF order_row.discount <> 0 OR order_row.promo_pricing_snapshot IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid order pricing snapshot for order %: ambiguous legacy discount', order_row.id;
      END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', product_id, 'unitPriceKopecks', price * 100, 'quantity', quantity,
        'subtotalKopecks', line_total * 100, 'promoDiscountKopecks', 0,
        'loyaltyPoints', 0, 'loyaltyDiscountKopecks', 0, 'totalKopecks', line_total * 100,
        'priceGroups', jsonb_build_array(jsonb_build_object(
          'quantity', quantity, 'unitPriceKopecks', price * 100,
          'promoDiscountPerUnitKopecks', 0, 'loyaltyPointsPerUnit', 0,
          'totalKopecks', line_total * 100))) ORDER BY created_at, product_id), '[]'::jsonb)
      INTO items FROM "order_items" WHERE order_id = order_row.id;
    END IF;
    order_row.pricing_snapshot := jsonb_build_object(
      'version', 1, 'currency', order_row.currency,
      'subtotalKopecks', order_row.subtotal * 100, 'promoDiscountKopecks', order_row.discount * 100,
      'loyaltyDiscountKopecks', 0, 'discountKopecks', order_row.discount * 100,
      'itemsTotalKopecks', (order_row.subtotal - order_row.discount) * 100,
      'deliveryKopecks', order_row.delivery_price * 100, 'totalKopecks', order_row.total * 100,
      'items', items);
    PERFORM validate_order_pricing_snapshot(order_row);
    UPDATE "orders" SET pricing_snapshot = order_row.pricing_snapshot WHERE id = order_row.id;
  END LOOP;
END;
$$;

CREATE FUNCTION guard_order_pricing_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.pricing_snapshot IS NOT NULL THEN
      IF OLD.pricing_snapshot IS DISTINCT FROM NEW.pricing_snapshot THEN
        RAISE EXCEPTION 'Order pricing snapshot is immutable';
      END IF;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.pricing_snapshot IS NOT NULL THEN
    PERFORM validate_order_pricing_snapshot(NEW);
  END IF;
  RETURN NEW;
END;
$$;

-- Checkout inserts the order/items and applies a promo before finalizing pricing.
CREATE TRIGGER "orders_immutable_pricing_snapshot"
BEFORE INSERT OR UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION guard_order_pricing_snapshot();

COMMIT;
