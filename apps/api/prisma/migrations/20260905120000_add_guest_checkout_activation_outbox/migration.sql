ALTER TABLE "orders"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "checkout_attempt_id" VARCHAR(128),
  ADD COLUMN "checkout_payload_fingerprint" CHAR(64),
  ADD COLUMN "yandex_client_id" VARCHAR(128),
  ADD COLUMN "yandex_yclid" VARCHAR(128);

ALTER TABLE "auth_accounts"
  ALTER COLUMN "provider_user_id" TYPE VARCHAR(320);

CREATE UNIQUE INDEX "orders_checkout_attempt_id_key" ON "orders"("checkout_attempt_id");

CREATE TYPE "order_checkout_throttle_scope" AS ENUM ('cart', 'ip');

CREATE TABLE "order_checkout_throttles" (
  "id" TEXT NOT NULL,
  "scope" "order_checkout_throttle_scope" NOT NULL,
  "subject_hash" CHAR(64) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_request_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blocked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_checkout_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_checkout_throttles_scope_subject_hash_key" ON "order_checkout_throttles"("scope", "subject_hash");
CREATE INDEX "order_checkout_throttles_blocked_until_idx" ON "order_checkout_throttles"("blocked_until");

CREATE TABLE "auth_order_activation_tokens" (
  "id" VARCHAR(32) NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "ip_hash" CHAR(64),
  "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_order_activation_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_order_activation_tokens_token_hash_key" ON "auth_order_activation_tokens"("token_hash");
CREATE INDEX "auth_order_activation_tokens_user_id_idx" ON "auth_order_activation_tokens"("user_id");
CREATE INDEX "auth_order_activation_tokens_expires_at_idx" ON "auth_order_activation_tokens"("expires_at");
CREATE INDEX "auth_order_activation_tokens_ip_hash_sent_at_idx" ON "auth_order_activation_tokens"("ip_hash", "sent_at");
CREATE INDEX "auth_order_activation_tokens_sent_at_idx" ON "auth_order_activation_tokens"("sent_at");

ALTER TABLE "auth_order_activation_tokens"
  ADD CONSTRAINT "auth_order_activation_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "auth_recovery_throttle_scope" AS ENUM ('email', 'ip');

CREATE TABLE "auth_recovery_throttles" (
  "id" TEXT NOT NULL,
  "scope" "auth_recovery_throttle_scope" NOT NULL,
  "subject_hash" CHAR(64) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_request_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blocked_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "auth_recovery_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_recovery_throttles_scope_subject_hash_key" ON "auth_recovery_throttles"("scope", "subject_hash");
CREATE INDEX "auth_recovery_throttles_blocked_until_idx" ON "auth_recovery_throttles"("blocked_until");

CREATE TYPE "analytics_outbox_status" AS ENUM ('pending', 'processing', 'sent', 'failed');

CREATE TABLE "analytics_outbox_events" (
  "id" TEXT NOT NULL,
  "event_type" VARCHAR(80) NOT NULL,
  "aggregate_id" VARCHAR(128) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "analytics_outbox_status" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "provider_response" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_outbox_events_event_type_aggregate_id_key" ON "analytics_outbox_events"("event_type", "aggregate_id");
CREATE INDEX "analytics_outbox_events_status_next_attempt_at_created_at_idx" ON "analytics_outbox_events"("status", "next_attempt_at", "created_at");
CREATE INDEX "analytics_outbox_events_status_locked_at_idx" ON "analytics_outbox_events"("status", "locked_at");
