CREATE TABLE "delivery_tracking_requests" (
  "order_id" VARCHAR(32) PRIMARY KEY,
  "revision" UUID NOT NULL UNIQUE,
  "provider" "order_delivery_provider" NOT NULL,
  "external_numbers" TEXT[] NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "delivery_tracking_observations" (
  "order_id" VARCHAR(32) PRIMARY KEY,
  "revision" UUID NOT NULL,
  "states" JSONB NOT NULL DEFAULT '[]',
  "all_delivered" BOOLEAN NOT NULL DEFAULT FALSE,
  "checked_at" TIMESTAMP(3),
  "next_check_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" UUID,
  "locked_until" TIMESTAMP(3),
  "last_error" VARCHAR(80)
);
CREATE TABLE "delivery_completion_events" (
  "id" UUID PRIMARY KEY,
  "order_id" VARCHAR(32) NOT NULL,
  "external_numbers" TEXT[] NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "delivery_completion_events_observed_at_id_idx" ON "delivery_completion_events" ("observed_at", "id");
CREATE TABLE "order_delivery_completion_receipts" (
  "event_id" UUID PRIMARY KEY,
  "completed" BOOLEAN NOT NULL,
  "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Publish existing explicit lists, never infer shipment links from comments.
INSERT INTO "delivery_tracking_requests" ("order_id", "revision", "provider", "external_numbers", "enabled")
SELECT "id", gen_random_uuid(), "delivery_provider", "ozon_posting_numbers",
       "crm_status" = 'delivering' AND "payment_status" = 'paid'
FROM "orders"
WHERE "delivery_provider" = 'ozon' AND cardinality("ozon_posting_numbers") > 0;
