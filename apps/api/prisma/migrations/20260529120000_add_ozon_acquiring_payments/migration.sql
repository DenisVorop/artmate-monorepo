-- AlterEnum
ALTER TYPE "order_payment_method" ADD VALUE 'ozon_acquiring';

-- AlterEnum
ALTER TYPE "order_payment_status" ADD VALUE 'failed';

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "ozon_acquiring_order_id" VARCHAR(120),
  ADD COLUMN "ozon_acquiring_payment_id" VARCHAR(120),
  ADD COLUMN "ozon_acquiring_transaction_id" VARCHAR(120),
  ADD COLUMN "ozon_acquiring_transaction_uid" VARCHAR(120),
  ADD COLUMN "payment_error_code" VARCHAR(120),
  ADD COLUMN "payment_error_message" TEXT,
  ADD COLUMN "last_payment_notification" JSONB;

-- CreateIndex
CREATE INDEX "orders_ozon_acquiring_order_id_idx" ON "orders"("ozon_acquiring_order_id");

-- CreateIndex
CREATE INDEX "orders_ozon_acquiring_payment_id_idx" ON "orders"("ozon_acquiring_payment_id");
