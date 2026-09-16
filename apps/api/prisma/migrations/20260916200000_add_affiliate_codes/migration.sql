ALTER TYPE "promo_code_kind" ADD VALUE 'affiliate';

ALTER TABLE "promo_codes"
  ADD COLUMN "affiliate_partner_id" VARCHAR(32),
  ADD COLUMN "affiliate_partner_percent" INTEGER,
  ADD COLUMN "affiliate_comment" VARCHAR(500),
  ADD CONSTRAINT "promo_codes_affiliate_partner_id_fkey"
    FOREIGN KEY ("affiliate_partner_id") REFERENCES "affiliate_partners"("id")
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT "promo_codes_affiliate_shape_check" CHECK (
    (
      "kind"::text = 'affiliate'
      AND "affiliate_partner_id" IS NOT NULL
      AND "affiliate_partner_percent" IS NOT NULL
      AND "affiliate_partner_percent" BETWEEN 0 AND 15
      AND "type" = 'percentage'
      AND "basis_points" = (20 - "affiliate_partner_percent") * 100
      AND "amount_kopecks" IS NULL
      AND "max_discount_kopecks" IS NULL
      AND "min_subtotal_kopecks" = 0
      AND "starts_at" IS NULL
      AND "ends_at" IS NULL
      AND "max_uses" IS NULL
      AND "max_uses_per_user" IS NULL
    )
    OR (
      "kind"::text <> 'affiliate'
      AND "affiliate_partner_id" IS NULL
      AND "affiliate_partner_percent" IS NULL
      AND "affiliate_comment" IS NULL
    )
  ),
  ADD CONSTRAINT "promo_codes_affiliate_comment_check" CHECK (
    "affiliate_comment" IS NULL
    OR char_length("affiliate_comment") <= 500
  );

CREATE INDEX "promo_codes_affiliate_partner_created_at_idx"
  ON "promo_codes"("affiliate_partner_id", "created_at");
