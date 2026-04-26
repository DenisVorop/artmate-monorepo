-- Link future orders to the authenticated user without breaking existing guest orders.
ALTER TABLE "orders" ADD COLUMN "user_id" TEXT;

CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
