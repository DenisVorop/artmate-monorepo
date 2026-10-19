ALTER TABLE "orders"
  ADD COLUMN "ozon_fbs_posting_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "orders_ozon_fbs_posting_numbers_check"
    CHECK ("ozon_fbs_posting_numbers" <@ "ozon_posting_numbers");

ALTER TABLE "delivery_tracking_requests"
  ADD COLUMN "ozon_fbs_posting_numbers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD CONSTRAINT "delivery_tracking_requests_ozon_fbs_posting_numbers_check"
    CHECK ("ozon_fbs_posting_numbers" <@ "external_numbers");
