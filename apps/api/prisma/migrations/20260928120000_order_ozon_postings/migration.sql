ALTER TABLE "orders"
ADD COLUMN "ozon_posting_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
