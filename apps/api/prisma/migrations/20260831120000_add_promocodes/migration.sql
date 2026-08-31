CREATE TYPE "promo_code_type" AS ENUM ('percentage', 'fixed');
CREATE TYPE "promo_redemption_status" AS ENUM ('reserved', 'used', 'released');

CREATE TABLE "promo_codes" (
  "id" TEXT PRIMARY KEY,
  "code" VARCHAR(40) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "type" "promo_code_type" NOT NULL,
  "basis_points" INTEGER,
  "amount_kopecks" BIGINT,
  "max_discount_kopecks" BIGINT,
  "min_subtotal_kopecks" BIGINT NOT NULL DEFAULT 0,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "max_uses" INTEGER,
  "max_uses_per_user" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "reserved_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promo_codes_code_format_check" CHECK ("code" ~ '^[A-Z0-9_-]{3,40}$'),
  CONSTRAINT "promo_codes_name_check" CHECK (length(btrim("name")) > 0),
  CONSTRAINT "promo_codes_discount_shape_check" CHECK (
    ("type" = 'percentage' AND "basis_points" IS NOT NULL AND "basis_points" BETWEEN 1 AND 10000 AND "amount_kopecks" IS NULL)
    OR ("type" = 'fixed' AND "basis_points" IS NULL AND "amount_kopecks" IS NOT NULL AND "amount_kopecks" > 0 AND "max_discount_kopecks" IS NULL)
  ),
  CONSTRAINT "promo_codes_max_discount_check" CHECK ("max_discount_kopecks" IS NULL OR "max_discount_kopecks" > 0),
  CONSTRAINT "promo_codes_min_subtotal_check" CHECK ("min_subtotal_kopecks" >= 0),
  CONSTRAINT "promo_codes_dates_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at"),
  CONSTRAINT "promo_codes_max_uses_check" CHECK ("max_uses" IS NULL OR "max_uses" > 0),
  CONSTRAINT "promo_codes_max_uses_per_user_check" CHECK ("max_uses_per_user" IS NULL OR "max_uses_per_user" > 0),
  CONSTRAINT "promo_codes_counters_check" CHECK ("used_count" >= 0 AND "reserved_count" >= 0),
  CONSTRAINT "promo_codes_code_key" UNIQUE ("code")
);

ALTER TABLE "orders"
  ADD COLUMN "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "promo_code" VARCHAR(40),
  ADD COLUMN "promo_terms_snapshot" JSONB,
  ADD COLUMN "promo_pricing_snapshot" JSONB,
  ADD CONSTRAINT "orders_discount_check" CHECK ("discount" >= 0 AND "discount" <= "subtotal"),
  ADD CONSTRAINT "orders_promo_snapshot_shape_check" CHECK (
    ("promo_code" IS NULL AND "discount" = 0 AND "promo_terms_snapshot" IS NULL AND "promo_pricing_snapshot" IS NULL)
    OR ("promo_code" IS NOT NULL AND "promo_terms_snapshot" IS NOT NULL AND "promo_pricing_snapshot" IS NOT NULL)
  );

CREATE TABLE "promo_redemptions" (
  "id" TEXT PRIMARY KEY,
  "promo_code_id" TEXT NOT NULL,
  "order_id" VARCHAR(32) NOT NULL,
  "user_id" TEXT,
  "status" "promo_redemption_status" NOT NULL DEFAULT 'reserved',
  "code_snapshot" VARCHAR(40) NOT NULL,
  "terms_snapshot" JSONB NOT NULL,
  "pricing_snapshot" JSONB NOT NULL,
  "subtotal_kopecks_snapshot" BIGINT NOT NULL,
  "discount_kopecks_snapshot" BIGINT NOT NULL,
  "total_kopecks_snapshot" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "used_at" TIMESTAMP(3),
  "released_at" TIMESTAMP(3),
  CONSTRAINT "promo_redemptions_money_check" CHECK (
    "subtotal_kopecks_snapshot" >= 0
    AND "discount_kopecks_snapshot" >= 0
    AND "total_kopecks_snapshot" >= 0
    AND "subtotal_kopecks_snapshot" = "discount_kopecks_snapshot" + "total_kopecks_snapshot"
  ),
  CONSTRAINT "promo_redemptions_status_dates_check" CHECK (
    ("status" = 'reserved' AND "used_at" IS NULL AND "released_at" IS NULL)
    OR ("status" = 'used' AND "used_at" IS NOT NULL AND "released_at" IS NULL)
    OR ("status" = 'released' AND "used_at" IS NULL AND "released_at" IS NOT NULL)
  ),
  CONSTRAINT "promo_redemptions_order_id_key" UNIQUE ("order_id"),
  CONSTRAINT "promo_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promo_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "promo_redemptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "promo_codes_active_dates_idx" ON "promo_codes"("is_active", "starts_at", "ends_at");
CREATE INDEX "promo_redemptions_promo_status_idx" ON "promo_redemptions"("promo_code_id", "status");
CREATE INDEX "promo_redemptions_promo_user_status_idx" ON "promo_redemptions"("promo_code_id", "user_id", "status");

CREATE FUNCTION prevent_promo_snapshot_update() RETURNS trigger AS $$
BEGIN
  IF OLD."code_snapshot" IS DISTINCT FROM NEW."code_snapshot"
    OR OLD."terms_snapshot" IS DISTINCT FROM NEW."terms_snapshot"
    OR OLD."pricing_snapshot" IS DISTINCT FROM NEW."pricing_snapshot"
    OR OLD."subtotal_kopecks_snapshot" IS DISTINCT FROM NEW."subtotal_kopecks_snapshot"
    OR OLD."discount_kopecks_snapshot" IS DISTINCT FROM NEW."discount_kopecks_snapshot"
    OR OLD."total_kopecks_snapshot" IS DISTINCT FROM NEW."total_kopecks_snapshot" THEN
    RAISE EXCEPTION 'promo redemption snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "promo_redemptions_immutable_snapshots"
BEFORE UPDATE ON "promo_redemptions"
FOR EACH ROW EXECUTE FUNCTION prevent_promo_snapshot_update();

CREATE FUNCTION prevent_order_promo_snapshot_update() RETURNS trigger AS $$
BEGIN
  IF OLD."promo_code" IS NOT NULL AND (
    OLD."promo_code" IS DISTINCT FROM NEW."promo_code"
    OR OLD."discount" IS DISTINCT FROM NEW."discount"
    OR OLD."promo_terms_snapshot" IS DISTINCT FROM NEW."promo_terms_snapshot"
    OR OLD."promo_pricing_snapshot" IS DISTINCT FROM NEW."promo_pricing_snapshot"
  ) THEN
    RAISE EXCEPTION 'order promo snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "orders_immutable_promo_snapshots"
BEFORE UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION prevent_order_promo_snapshot_update();
