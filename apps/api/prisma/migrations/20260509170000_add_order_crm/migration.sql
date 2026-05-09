-- CreateEnum
CREATE TYPE "order_crm_status" AS ENUM ('new', 'in_progress', 'waiting_payment', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "crm_status" "order_crm_status" NOT NULL DEFAULT 'new';

-- CreateTable
CREATE TABLE "order_admin_comments" (
    "id" TEXT NOT NULL,
    "order_id" VARCHAR(32) NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_admin_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_crm_status_created_at_idx" ON "orders"("crm_status", "created_at");

-- CreateIndex
CREATE INDEX "order_admin_comments_order_id_created_at_idx" ON "order_admin_comments"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "order_admin_comments_author_id_idx" ON "order_admin_comments"("author_id");

-- AddForeignKey
ALTER TABLE "order_admin_comments" ADD CONSTRAINT "order_admin_comments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_admin_comments" ADD CONSTRAINT "order_admin_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
