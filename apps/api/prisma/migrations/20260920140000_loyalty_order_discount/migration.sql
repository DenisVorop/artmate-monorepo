BEGIN;

-- The canonical snapshot now accounts for both promo and loyalty discounts.
-- Keep promo audit snapshots coupled to an actual promo code. A positive
-- discount without a promo must be fully explained by the loyalty snapshot.
-- Full snapshot arithmetic and immutability remain guarded by existing triggers.
ALTER TABLE "orders"
  DROP CONSTRAINT "orders_promo_snapshot_shape_check",
  ADD CONSTRAINT "orders_promo_snapshot_shape_check" CHECK ((
    (
      "promo_code" IS NULL
      AND "promo_terms_snapshot" IS NULL
      AND "promo_pricing_snapshot" IS NULL
      AND (
        "discount" = 0
        OR (
          "discount" > 0
          AND "pricing_snapshot" IS NOT NULL
          AND jsonb_typeof("pricing_snapshot" -> 'promoDiscountKopecks') = 'number'
          AND "pricing_snapshot" -> 'promoDiscountKopecks' = '0'::jsonb
          AND jsonb_typeof("pricing_snapshot" -> 'loyaltyDiscountKopecks') = 'number'
          AND "pricing_snapshot" -> 'loyaltyDiscountKopecks' = to_jsonb("discount" * 100)
        )
      )
    )
    OR (
      "promo_code" IS NOT NULL
      AND "promo_terms_snapshot" IS NOT NULL
      AND "promo_pricing_snapshot" IS NOT NULL
    )
  ) IS TRUE);

COMMIT;
