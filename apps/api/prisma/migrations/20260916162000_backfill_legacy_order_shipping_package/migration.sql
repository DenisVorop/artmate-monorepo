-- Owner-approved backfill for the one legacy order inspected on 2026-09-16.
-- Preserve the old ready-to-ship album configuration, never current Product data.
-- Recheck open orders before deployment: a changed order is deliberately skipped.
WITH "expected_items" ("product_id", "slug") AS (
  VALUES
    ('cmouggbdz000001p7txxxmq6i', 'raskraska-po-nomeram-peizaji'),
    ('cmougm5r0000801p73xta4gkt', 'raskraska-po-nomeram-peizaji-2'),
    ('prod_yaponiya_1232256239', 'raskraska-po-nomeram-yaponiya')
), "eligible_order" AS (
  SELECT "o"."id"
  FROM "orders" AS "o"
  WHERE "o"."id" = 'AM-D22C13FE'
    AND "o"."delivery_provider" = 'cdek'
    AND "o"."status" = 'pending_payment'
    AND "o"."crm_status" = 'waiting_payment'
    AND NOT EXISTS (
      SELECT 1 FROM "order_shipments" AS "s"
      WHERE "s"."order_id" = "o"."id"
    )
    AND (
      SELECT count(*) FROM "order_items" AS "i"
      WHERE "i"."order_id" = "o"."id"
    ) = 3
    AND NOT EXISTS (
      SELECT 1
      FROM "order_items" AS "i"
      LEFT JOIN "expected_items" AS "expected"
        ON "expected"."product_id" = "i"."product_id"
        AND "expected"."slug" = "i"."slug"
      WHERE "i"."order_id" = "o"."id"
        AND ("expected"."product_id" IS NULL OR "i"."quantity" <> 1)
    )
)
UPDATE "order_items" AS "i"
SET "shipping_package_snapshot" = jsonb_build_object(
  'version', 1,
  'id', 'shipping_album',
  'code', 'album',
  'weightGrams', 400,
  'lengthCm', 40,
  'widthCm', 30,
  'heightCm', 1
)
FROM "eligible_order" AS "o"
WHERE "i"."order_id" = "o"."id"
  AND "i"."shipping_package_snapshot" IS NULL;
