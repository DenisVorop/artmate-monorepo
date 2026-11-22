ALTER TYPE "order_status" ADD VALUE 'fulfillment_ready';
ALTER TYPE "order_payment_method" ADD VALUE 'contest_prize';
ALTER TYPE "order_payment_status" ADD VALUE 'not_required';
ALTER TABLE "contests" ADD COLUMN "prize_album_quantity" INTEGER,
  ADD COLUMN "prize_album_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT contests_album_prize_shape CHECK (
    (prize_album_quantity IS NULL AND cardinality(prize_album_ids) = 0) OR
    (prize_album_quantity BETWEEN 1 AND 20 AND cardinality(prize_album_ids) >= prize_album_quantity AND cardinality(prize_album_ids) <= 200)
  );
ALTER TABLE "orders" ADD COLUMN "sponsored_delivery_price" DECIMAL(12,2);
CREATE TABLE "order_prize_grants" (
  "id" VARCHAR(32) PRIMARY KEY,
  "winner_id" VARCHAR(32) NOT NULL UNIQUE REFERENCES "contest_draw_winners"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "contest_title" VARCHAR(160) NOT NULL,
  "contest_slug" VARCHAR(120) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "album_ids" TEXT[] NOT NULL,
  "awarded_at" TIMESTAMPTZ(3) NOT NULL,
  "order_id" VARCHAR(32) UNIQUE REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "checkout_fingerprint" CHAR(64),
  "redeemed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT order_prize_grant_quantity CHECK (quantity BETWEEN 1 AND 20 AND cardinality(album_ids) >= quantity),
  CONSTRAINT order_prize_grant_redemption CHECK (
    (order_id IS NULL AND redeemed_at IS NULL AND checkout_fingerprint IS NULL) OR
    (order_id IS NOT NULL AND redeemed_at IS NOT NULL AND checkout_fingerprint IS NOT NULL)
  )
);
CREATE INDEX "order_prize_grants_user_id_awarded_at_idx" ON "order_prize_grants"("user_id", "awarded_at");
