BEGIN;

CREATE TYPE "order_payment_recovery_status" AS ENUM ('pending', 'checking', 'attention', 'resolved');
CREATE TABLE "order_payment_recoveries" (
  "order_id" VARCHAR(32) PRIMARY KEY REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "status" "order_payment_recovery_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lease_token" UUID,
  "locked_until" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "last_error" VARCHAR(80),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_payment_recoveries_lease_shape" CHECK (
    (status = 'checking' AND lease_token IS NOT NULL AND locked_until IS NOT NULL AND finished_at IS NULL)
    OR (status <> 'checking' AND lease_token IS NULL AND locked_until IS NULL)
  ),
  CONSTRAINT "order_payment_recoveries_finished_shape" CHECK (
    (status = 'resolved') = (finished_at IS NOT NULL)
  ),
  CONSTRAINT "order_payment_recoveries_reason_check" CHECK (
    last_error IS NULL OR last_error IN ('provider_pending','provider_unavailable','provider_error',
      'payment_not_found','payment_ambiguous','amount_mismatch','identity_mismatch','unsupported_provider',
      'retry_limit','lease_expired','manual_retry','closure_unconfirmed')
  )
);
CREATE INDEX "order_payment_recoveries_status_next_attempt_at_locked_until_idx"
  ON "order_payment_recoveries"("status", "next_attempt_at", "locked_until");

-- A provider reference, initialization marker, external payment URL, or the old
-- durable Ozon queue is evidence of an attempt. Never initialize an untouched order.
INSERT INTO "order_payment_recoveries" ("order_id", "next_attempt_at")
SELECT o.id, CURRENT_TIMESTAMP + interval '60 seconds'
FROM orders o LEFT JOIN order_ozon_payment_rechecks old ON old.order_id = o.id
WHERE o.payment_method::text IN ('ozon_acquiring','tbank_acquiring')
  AND o.payment_status::text NOT IN ('paid','closed_unpaid') AND o.paid_at IS NULL
  AND (
    o.ozon_acquiring_order_id IS NOT NULL OR o.ozon_acquiring_payment_id IS NOT NULL
    OR o.tbank_acquiring_order_id IS NOT NULL OR o.tbank_acquiring_payment_id IS NOT NULL
    OR o.payment_redirect_url LIKE '/checkout/payment-initializing%'
    OR o.payment_redirect_url ~ '^https?://'
    OR old.order_id IS NOT NULL
  );

DROP TABLE "order_ozon_payment_rechecks";

COMMIT;
