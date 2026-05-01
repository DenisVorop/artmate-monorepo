CREATE TYPE "product_status" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "products" (
  "id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "status" "product_status" NOT NULL DEFAULT 'draft',
  "price" INTEGER NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'RUB',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_images" (
  "id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(32) NOT NULL,
  "url" TEXT NOT NULL,
  "alt" VARCHAR(220),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");
CREATE INDEX "products_status_created_at_idx" ON "products"("status", "created_at");
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

ALTER TABLE "product_images"
  ADD CONSTRAINT "product_images_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
