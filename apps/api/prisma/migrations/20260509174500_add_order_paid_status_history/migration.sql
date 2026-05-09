-- AlterEnum
ALTER TYPE "order_crm_status" ADD VALUE 'paid' AFTER 'waiting_payment';

-- CreateTable
CREATE TABLE "order_history" (
    "id" TEXT NOT NULL,
    "order_id" VARCHAR(32) NOT NULL,
    "author_id" TEXT,
    "event_type" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_history_pkey" PRIMARY KEY ("id")
);

-- Backfill a baseline history item for existing orders.
INSERT INTO "order_history" ("id", "order_id", "event_type", "payload", "created_at")
SELECT
    'initial-' || "id",
    "id",
    'status_changed',
    jsonb_build_object(
      'fromStatus', NULL,
      'toStatus', "crm_status",
      'source', 'migration'
    ),
    "updated_at"
FROM "orders";

-- CreateIndex
CREATE INDEX "order_history_order_id_created_at_idx" ON "order_history"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_history_author_id_idx" ON "order_history"("author_id");

-- CreateIndex
CREATE INDEX "order_history_event_type_idx" ON "order_history"("event_type");

-- AddForeignKey
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_history" ADD CONSTRAINT "order_history_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
