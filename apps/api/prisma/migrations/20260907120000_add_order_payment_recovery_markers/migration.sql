ALTER TABLE "orders"
  ADD COLUMN "terminal_payment_failed_at" TIMESTAMP(3),
  ADD COLUMN "cart_consumed_at" TIMESTAMP(3),
  ADD COLUMN "cart_consumed_quantities" JSONB,
  ADD COLUMN "cart_restored_at" TIMESTAMP(3),
  ADD COLUMN "cart_restored_quantities" JSONB;
