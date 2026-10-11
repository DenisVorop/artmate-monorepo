ALTER TABLE "products" ADD COLUMN "sale_price" INTEGER;

ALTER TABLE "products" ADD CONSTRAINT "products_sale_price_check"
  CHECK ("sale_price" IS NULL OR (
    "sale_price" > 0 AND "sale_price" < "price" AND "sale_price" % 100 = 0
  ));
