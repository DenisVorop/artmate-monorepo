-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('pending_payment', 'paid');

-- CreateEnum
CREATE TYPE "order_payment_method" AS ENUM ('bank_card_mock');

-- CreateEnum
CREATE TYPE "order_payment_status" AS ENUM ('pending', 'paid');

-- CreateEnum
CREATE TYPE "order_delivery_provider" AS ENUM ('ozon');

-- CreateTable
CREATE TABLE "carts" (
    "id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "cart_id" VARCHAR(128) NOT NULL,
    "product_id" VARCHAR(191) NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "category_slug" VARCHAR(160) NOT NULL,
    "image" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("cart_id","product_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" VARCHAR(32) NOT NULL,
    "cart_id" VARCHAR(128) NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'pending_payment',
    "customer_name" VARCHAR(160) NOT NULL,
    "customer_phone" VARCHAR(80) NOT NULL,
    "customer_email" VARCHAR(320) NOT NULL,
    "delivery_provider" "order_delivery_provider" NOT NULL DEFAULT 'ozon',
    "pickup_point_id" VARCHAR(160) NOT NULL,
    "pickup_point_title" VARCHAR(180) NOT NULL,
    "pickup_point_address" TEXT NOT NULL,
    "pickup_point_work_hours" VARCHAR(120) NOT NULL,
    "delivery_price" DECIMAL(12,2) NOT NULL,
    "payment_method" "order_payment_method" NOT NULL DEFAULT 'bank_card_mock',
    "payment_status" "order_payment_status" NOT NULL DEFAULT 'pending',
    "payment_redirect_url" TEXT NOT NULL,
    "items_count" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
    "comment" TEXT,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_id" VARCHAR(32) NOT NULL,
    "product_id" VARCHAR(191) NOT NULL,
    "title" VARCHAR(220) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "category_slug" VARCHAR(160) NOT NULL,
    "image" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_id","product_id")
);

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "orders_cart_id_idx" ON "orders"("cart_id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_email_idx" ON "orders"("customer_email");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
