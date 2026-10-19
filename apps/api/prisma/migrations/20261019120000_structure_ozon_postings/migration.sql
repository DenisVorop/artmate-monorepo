ALTER TABLE "orders"
  ADD COLUMN "ozon_postings" JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD CONSTRAINT "orders_ozon_postings_array_check"
    CHECK (jsonb_typeof("ozon_postings") = 'array');

UPDATE "orders"
SET "ozon_postings" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('number', number, 'scheme', 'fbo') ORDER BY number)
  FROM unnest("ozon_posting_numbers") AS number
), '[]'::JSONB);

ALTER TABLE "orders" DROP COLUMN "ozon_posting_numbers";

ALTER TABLE "delivery_tracking_requests"
  ADD COLUMN "ozon_postings" JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD CONSTRAINT "delivery_tracking_requests_ozon_postings_array_check"
    CHECK (jsonb_typeof("ozon_postings") = 'array');

UPDATE "delivery_tracking_requests"
SET "ozon_postings" = COALESCE((
  SELECT jsonb_agg(jsonb_build_object('number', number, 'scheme', 'fbo') ORDER BY number)
  FROM unnest("external_numbers") AS number
), '[]'::JSONB);

ALTER TABLE "delivery_tracking_requests" DROP COLUMN "external_numbers";
