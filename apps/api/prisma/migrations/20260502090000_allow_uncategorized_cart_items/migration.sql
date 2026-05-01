ALTER TABLE "cart_items"
  ALTER COLUMN "category" DROP NOT NULL,
  ALTER COLUMN "category_slug" DROP NOT NULL;

ALTER TABLE "order_items"
  ALTER COLUMN "category" DROP NOT NULL,
  ALTER COLUMN "category_slug" DROP NOT NULL;
