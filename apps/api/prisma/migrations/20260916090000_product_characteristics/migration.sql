ALTER TABLE "products" ADD COLUMN "usage_instructions" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "products_usage_instructions_check"
  CHECK ("usage_instructions" IS NULL OR (
    char_length("usage_instructions") BETWEEN 1 AND 6000
    AND "usage_instructions" !~ '[<>]'
  ));

CREATE TABLE "product_characteristics" (
  "id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(32) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "value" VARCHAR(500) NOT NULL,
  "is_highlighted" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL,
  CONSTRAINT "product_characteristics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_characteristics_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_characteristics_name_check"
    CHECK (char_length(btrim("name")) > 0 AND "name" !~ '[<>]'),
  CONSTRAINT "product_characteristics_value_check"
    CHECK (char_length(btrim("value")) > 0 AND "value" !~ '[<>]'),
  CONSTRAINT "product_characteristics_sort_order_check"
    CHECK ("sort_order" BETWEEN 0 AND 29)
);

CREATE UNIQUE INDEX "product_characteristics_product_id_sort_order_key"
  ON "product_characteristics"("product_id", "sort_order");
CREATE UNIQUE INDEX "product_characteristics_product_id_normalized_name_key"
  ON "product_characteristics"("product_id", lower(btrim("name")));
