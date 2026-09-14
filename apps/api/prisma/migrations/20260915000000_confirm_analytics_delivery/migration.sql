-- SENT records an accepted upload; only CONFIRMED means Yandex processed it.
-- Existing SENT rows are intentionally retained. The worker checks their upload
-- IDs with GET, without resubmitting conversions or creating historical events.
ALTER TYPE "analytics_outbox_status" ADD VALUE 'confirmed';

ALTER TABLE "analytics_outbox_events"
  ADD COLUMN "confirmed_at" TIMESTAMP(3),
  ADD COLUMN "provider_status" VARCHAR(32);
