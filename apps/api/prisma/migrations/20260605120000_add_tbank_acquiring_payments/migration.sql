-- AlterEnum
ALTER TYPE "order_payment_method" ADD VALUE 'tbank_acquiring';

-- AlterTable
ALTER TABLE "orders"
  ADD COLUMN "tbank_acquiring_order_id" VARCHAR(36),
  ADD COLUMN "tbank_acquiring_payment_id" VARCHAR(20);

-- CreateIndex
CREATE INDEX "orders_tbank_acquiring_order_id_idx" ON "orders"("tbank_acquiring_order_id");

-- CreateIndex
CREATE INDEX "orders_tbank_acquiring_payment_id_idx" ON "orders"("tbank_acquiring_payment_id");
