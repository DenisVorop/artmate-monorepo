BEGIN;

-- CreateEnum
CREATE TYPE "email_advertising_attempt_outcome" AS ENUM ('pending', 'accepted', 'rejected', 'not_sent', 'uncertain');

-- CreateEnum
CREATE TYPE "email_advertising_access_action" AS ENUM ('evidence_export', 'admin_revoke');

-- CreateEnum
CREATE TYPE "auth_identity_method" AS ENUM ('email_code', 'yandex_verified_email');

-- CreateEnum
CREATE TYPE "auth_pending_flow_status" AS ENUM ('open', 'completing', 'completed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "auth_completion_status" AS ENUM ('pending', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "consent_kind" AS ENUM ('personal_data', 'email_advertising');

-- CreateEnum
CREATE TYPE "consent_command_status" AS ENUM ('pending', 'completed', 'rejected');

-- CreateEnum
CREATE TYPE "email_advertising_state" AS ENUM ('revoked', 'active');

-- CreateEnum
CREATE TYPE "email_advertising_action" AS ENUM ('granted', 'revoked');

-- CreateEnum
CREATE TYPE "customer_profile_command_status" AS ENUM ('pending', 'completed', 'rejected');

-- CreateTable
CREATE TABLE "email_advertising_delivery_attempts" (
    "id" TEXT NOT NULL,
    "logical_send_id" VARCHAR(128) NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "lease_token" UUID NOT NULL,
    "grant_event_id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "sender" VARCHAR(320) NOT NULL,
    "message_id" VARCHAR(255) NOT NULL,
    "message_bytes" BYTEA NOT NULL,
    "message_sha256" CHAR(64) NOT NULL,
    "outcome" "email_advertising_attempt_outcome" NOT NULL DEFAULT 'pending',
    "provider_receipt_id" VARCHAR(255),
    "outcome_code" VARCHAR(80),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "email_advertising_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_advertising_access_events" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "actor_user_id_snapshot" TEXT NOT NULL,
    "action" "email_advertising_access_action" NOT NULL,
    "operation_key" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(512) NOT NULL,
    "request_id" VARCHAR(128) NOT NULL,
    "request_context" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_advertising_access_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_email_challenges" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "hash_key_version" VARCHAR(32) NOT NULL,
    "nonce" VARCHAR(64) NOT NULL,
    "browser_binding_hash" CHAR(64) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "resend_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "resend_available_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_hash" CHAR(64),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_email_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verified_identity_facts" (
    "id" TEXT NOT NULL,
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "email" VARCHAR(320) NOT NULL,
    "request_context" JSONB NOT NULL,
    "method" "auth_identity_method" NOT NULL,
    "source_id" VARCHAR(128) NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_identity_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_pending_flows" (
    "id" TEXT NOT NULL,
    "capability_hash" CHAR(64) NOT NULL,
    "browser_binding_hash" CHAR(64) NOT NULL,
    "identity_fact_id" TEXT NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "user_id_snapshot" TEXT,
    "profile_revision" INTEGER,
    "draft_name" VARCHAR(120),
    "draft_phone" VARCHAR(80),
    "status" "auth_pending_flow_status" NOT NULL DEFAULT 'open',
    "current_operation_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_pending_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_completion_operations" (
    "id" TEXT NOT NULL,
    "flow_id" TEXT NOT NULL,
    "operation_key" VARCHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "identity_fact_id" TEXT NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "status" "auth_completion_status" NOT NULL DEFAULT 'pending',
    "result_user_id" TEXT,
    "error_code" VARCHAR(80),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_completion_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_revisions" (
    "id" TEXT NOT NULL,
    "kind" "consent_kind" NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "version" VARCHAR(64) NOT NULL,
    "document_title" VARCHAR(255) NOT NULL,
    "document_bytes" BYTEA NOT NULL,
    "document_sha256" CHAR(64) NOT NULL,
    "form_snapshot_bytes" BYTEA NOT NULL,
    "form_sha256" CHAR(64) NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consent_states" (
    "email" VARCHAR(320) NOT NULL,
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL,
    "required_acceptances" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consent_states_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "apply_consent_decision_commands" (
    "id" TEXT NOT NULL,
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "operation_id" TEXT NOT NULL,
    "identity_fact_id" TEXT NOT NULL,
    "expected_state_revision" INTEGER NOT NULL,
    "expected_advertising_version" INTEGER NOT NULL,
    "decisions" JSONB NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "source" VARCHAR(255),
    "request_id" VARCHAR(128) NOT NULL,
    "request_context" JSONB NOT NULL,
    "status" "consent_command_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "locked_until" TIMESTAMP(3),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result_state_revision" INTEGER,
    "error_code" VARCHAR(80),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apply_consent_decision_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "required_consent_acceptances" (
    "id" TEXT NOT NULL,
    "operation_id" TEXT NOT NULL,
    "identity_fact_id" TEXT NOT NULL,
    "actor_user_id_snapshot" TEXT,
    "email" VARCHAR(320) NOT NULL,
    "revision_id" TEXT NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "source" VARCHAR(255),
    "request_id" VARCHAR(128) NOT NULL,
    "request_context" JSONB NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "required_consent_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_advertising_subscriptions" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(320),
    "recipient_key" CHAR(64) NOT NULL,
    "key_version" VARCHAR(32) NOT NULL,
    "state" "email_advertising_state" NOT NULL DEFAULT 'revoked',
    "version" INTEGER NOT NULL DEFAULT 0,
    "active_grant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_advertising_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_advertising_consent_events" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operation_key" VARCHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "action" "email_advertising_action" NOT NULL,
    "auth_operation_id" TEXT,
    "identity_fact_id" TEXT,
    "actor_user_id_snapshot" TEXT,
    "email" VARCHAR(320) NOT NULL,
    "revision_id" TEXT,
    "source" VARCHAR(255),
    "request_id" VARCHAR(128) NOT NULL,
    "request_context" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_advertising_consent_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profile_states" (
    "user_id" TEXT NOT NULL,
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL,
    "email" VARCHAR(320),
    "name" VARCHAR(120),
    "phone" VARCHAR(80),
    "status" "user_status" NOT NULL,
    "auth_version" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_profile_states_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ensure_customer_profile_commands" (
    "id" TEXT NOT NULL,
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "operation_id" TEXT NOT NULL,
    "identity_fact_id" TEXT NOT NULL,
    "expected_user_id" TEXT,
    "expected_profile_revision" INTEGER,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(80) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "status" "customer_profile_command_status" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_token" UUID,
    "locked_until" TIMESTAMP(3),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result_user_id" TEXT,
    "result_profile_revision" INTEGER,
    "error_code" VARCHAR(80),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ensure_customer_profile_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_advertising_delivery_attempts_grant_event_id_started__idx" ON "email_advertising_delivery_attempts"("grant_event_id", "started_at");

-- CreateIndex
CREATE INDEX "email_advertising_delivery_attempts_outcome_started_at_idx" ON "email_advertising_delivery_attempts"("outcome", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_delivery_attempts_logical_send_id_attempt_key" ON "email_advertising_delivery_attempts"("logical_send_id", "attempt_number");

-- CreateIndex
CREATE INDEX "email_advertising_access_events_subscription_id_occurred_at_idx" ON "email_advertising_access_events"("subscription_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_access_events_subscription_id_operation_k_key" ON "email_advertising_access_events"("subscription_id", "operation_key");

-- CreateIndex
CREATE INDEX "auth_email_challenges_email_sent_at_idx" ON "auth_email_challenges"("email", "sent_at");

-- CreateIndex
CREATE INDEX "auth_email_challenges_ip_hash_sent_at_idx" ON "auth_email_challenges"("ip_hash", "sent_at");

-- CreateIndex
CREATE INDEX "auth_email_challenges_expires_at_idx" ON "auth_email_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "verified_identity_facts_email_verified_at_idx" ON "verified_identity_facts"("email", "verified_at");

-- CreateIndex
CREATE UNIQUE INDEX "verified_identity_facts_method_source_id_key" ON "verified_identity_facts"("method", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_pending_flows_capability_hash_key" ON "auth_pending_flows"("capability_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_pending_flows_current_operation_id_key" ON "auth_pending_flows"("current_operation_id");

-- CreateIndex
CREATE INDEX "auth_pending_flows_expires_at_idx" ON "auth_pending_flows"("expires_at");

-- CreateIndex
CREATE INDEX "auth_completion_operations_status_created_at_idx" ON "auth_completion_operations"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_completion_operations_flow_id_operation_key_key" ON "auth_completion_operations"("flow_id", "operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "auth_completion_operations_id_identity_fact_id_key" ON "auth_completion_operations"("id", "identity_fact_id");

-- CreateIndex
CREATE INDEX "consent_revisions_kind_purpose_published_at_idx" ON "consent_revisions"("kind", "purpose", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "consent_revisions_kind_purpose_version_key" ON "consent_revisions"("kind", "purpose", "version");

-- CreateIndex
CREATE UNIQUE INDEX "apply_consent_decision_commands_operation_id_key" ON "apply_consent_decision_commands"("operation_id");

-- CreateIndex
CREATE INDEX "apply_consent_decision_commands_status_available_at_idx" ON "apply_consent_decision_commands"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "apply_consent_decision_commands_operation_id_identity_fact__key" ON "apply_consent_decision_commands"("operation_id", "identity_fact_id");

-- CreateIndex
CREATE INDEX "required_consent_acceptances_email_purpose_accepted_at_idx" ON "required_consent_acceptances"("email", "purpose", "accepted_at");

-- CreateIndex
CREATE UNIQUE INDEX "required_consent_acceptances_operation_id_revision_id_key" ON "required_consent_acceptances"("operation_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_subscriptions_email_key" ON "email_advertising_subscriptions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_subscriptions_active_grant_id_key" ON "email_advertising_subscriptions"("active_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_subscriptions_id_active_grant_id_key" ON "email_advertising_subscriptions"("id", "active_grant_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_subscriptions_recipient_key_key_version_key" ON "email_advertising_subscriptions"("recipient_key", "key_version");

-- CreateIndex
CREATE INDEX "email_advertising_consent_events_email_occurred_at_idx" ON "email_advertising_consent_events"("email", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_consent_events_subscription_id_id_key" ON "email_advertising_consent_events"("subscription_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_consent_events_auth_operation_id_revision_key" ON "email_advertising_consent_events"("auth_operation_id", "revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_consent_events_subscription_id_version_key" ON "email_advertising_consent_events"("subscription_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "email_advertising_consent_events_subscription_id_operation__key" ON "email_advertising_consent_events"("subscription_id", "operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profile_states_email_key" ON "customer_profile_states"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ensure_customer_profile_commands_operation_id_key" ON "ensure_customer_profile_commands"("operation_id");

-- CreateIndex
CREATE INDEX "ensure_customer_profile_commands_status_available_at_idx" ON "ensure_customer_profile_commands"("status", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "ensure_customer_profile_commands_operation_id_identity_fact_key" ON "ensure_customer_profile_commands"("operation_id", "identity_fact_id");

-- AddForeignKey
ALTER TABLE "email_advertising_delivery_attempts" ADD CONSTRAINT "email_advertising_delivery_attempts_grant_event_id_fkey" FOREIGN KEY ("grant_event_id") REFERENCES "email_advertising_consent_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_advertising_access_events" ADD CONSTRAINT "email_advertising_access_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "email_advertising_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_pending_flows" ADD CONSTRAINT "auth_pending_flows_identity_fact_id_fkey" FOREIGN KEY ("identity_fact_id") REFERENCES "verified_identity_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_pending_flows" ADD CONSTRAINT "auth_pending_flows_current_operation_id_fkey" FOREIGN KEY ("current_operation_id") REFERENCES "auth_completion_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_completion_operations" ADD CONSTRAINT "auth_completion_operations_identity_fact_id_fkey" FOREIGN KEY ("identity_fact_id") REFERENCES "verified_identity_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apply_consent_decision_commands" ADD CONSTRAINT "apply_consent_decision_commands_operation_id_identity_fact_fkey" FOREIGN KEY ("operation_id", "identity_fact_id") REFERENCES "auth_completion_operations"("id", "identity_fact_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_consent_acceptances" ADD CONSTRAINT "required_consent_acceptances_operation_id_identity_fact_id_fkey" FOREIGN KEY ("operation_id", "identity_fact_id") REFERENCES "auth_completion_operations"("id", "identity_fact_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_consent_acceptances" ADD CONSTRAINT "required_consent_acceptances_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "consent_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_advertising_subscriptions" ADD CONSTRAINT "email_advertising_subscriptions_id_active_grant_id_fkey" FOREIGN KEY ("id", "active_grant_id") REFERENCES "email_advertising_consent_events"("subscription_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_advertising_consent_events" ADD CONSTRAINT "email_advertising_consent_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "email_advertising_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_advertising_consent_events" ADD CONSTRAINT "email_advertising_consent_events_auth_operation_id_identit_fkey" FOREIGN KEY ("auth_operation_id", "identity_fact_id") REFERENCES "auth_completion_operations"("id", "identity_fact_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_advertising_consent_events" ADD CONSTRAINT "email_advertising_consent_events_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "consent_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile_states" ADD CONSTRAINT "customer_profile_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ensure_customer_profile_commands" ADD CONSTRAINT "ensure_customer_profile_commands_operation_id_identity_fac_fkey" FOREIGN KEY ("operation_id", "identity_fact_id") REFERENCES "auth_completion_operations"("id", "identity_fact_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain-owned contracts. No publication, acceptance, identity or grant backfill.
-- CHECKs/triggers supplement Prisma's structural schema. Retention must use a
-- separately privileged maintenance operation; there is no session flag bypass.

-- Full available HTTP metadata, represented by RequestEvidenceV1. Sanitization
-- happens at the HTTP boundary before publication; credentials are never evidence.
CREATE FUNCTION _request_evidence_v1(context jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT COALESCE(
    jsonb_typeof(context) = 'object' AND context->'version' = '1'::jsonb
    AND context->>'source' IN ('direct_request', 'trusted_site_proxy')
    AND jsonb_typeof(context->'capturedAt') = 'string' AND length(context->>'capturedAt') > 0
    AND jsonb_typeof(context->'http') = 'object'
    AND jsonb_typeof(context#>'{http,method}') = 'string' AND length(context#>>'{http,method}') > 0
    AND jsonb_typeof(context#>'{http,url}') = 'string' AND length(context#>>'{http,url}') > 0
    AND jsonb_typeof(context#>'{http,version}') = 'string'
    AND jsonb_typeof(context->'headers') = 'object'
    AND jsonb_typeof(context->'query') = 'object'
    AND jsonb_typeof(context->'connection') = 'object'
    AND (context->'connection') ?& ARRAY['remoteAddress', 'remotePort', 'localAddress', 'localPort', 'encrypted']
    AND jsonb_typeof(context#>'{connection,encrypted}') = 'boolean'
    AND jsonb_typeof(context->'client') = 'object'
    AND (context->'client') ? 'ipAddress'
    AND jsonb_typeof(context#>'{client,forwardedFor}') = 'array'
    AND jsonb_typeof(context#>'{client,forwardedHeadersTrusted}') = 'boolean'
  , false);
$$;

ALTER TABLE auth_email_challenges ADD CONSTRAINT auth_challenge_bounds CHECK (
  code_hash ~ '^[0-9a-f]{64}$' AND browser_binding_hash ~ '^[0-9a-f]{64}$'
  AND (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{64}$')
  AND length(hash_key_version) > 0 AND length(nonce) > 0 AND length(btrim(email)) > 0
  AND max_attempts > 0 AND failed_attempts BETWEEN 0 AND max_attempts
  AND generation > 0 AND resend_count >= 0 AND expires_at > created_at
  AND resend_available_at >= sent_at AND sent_at >= created_at
);
ALTER TABLE verified_identity_facts ADD CONSTRAINT verified_identity_v1 CHECK (
  contract_version = 1 AND length(btrim(email)) > 0 AND length(source_id) > 0
  AND _request_evidence_v1(request_context)
  AND verified_at <= created_at
);
ALTER TABLE auth_pending_flows ADD CONSTRAINT auth_pending_bounds CHECK (
  capability_hash ~ '^[0-9a-f]{64}$' AND browser_binding_hash ~ '^[0-9a-f]{64}$'
  AND length(purpose) > 0 AND expires_at > created_at
  AND (profile_revision IS NULL OR profile_revision > 0)
  AND ((status IN ('open', 'completing') AND finished_at IS NULL)
    OR (status IN ('completed', 'cancelled', 'expired') AND finished_at IS NOT NULL))
  AND (status <> 'completing' OR current_operation_id IS NOT NULL)
);
ALTER TABLE auth_completion_operations ADD CONSTRAINT auth_completion_result CHECK (
  payload_hash ~ '^[0-9a-f]{64}$' AND length(operation_key) > 0 AND length(purpose) > 0
  AND ((status = 'pending' AND result_user_id IS NULL AND error_code IS NULL AND finished_at IS NULL)
    OR (status = 'completed' AND result_user_id IS NOT NULL AND error_code IS NULL AND finished_at IS NOT NULL)
    OR (status = 'rejected' AND result_user_id IS NULL AND error_code IS NOT NULL AND finished_at IS NOT NULL))
);
ALTER TABLE customer_profile_states ADD CONSTRAINT customer_profile_state_v1 CHECK (
  contract_version = 1 AND revision > 0 AND auth_version >= 0
);
ALTER TABLE ensure_customer_profile_commands ADD CONSTRAINT profile_command_v1 CHECK (
  contract_version = 1 AND payload_hash ~ '^[0-9a-f]{64}$' AND attempts >= 0
  AND length(btrim(name)) > 0 AND length(btrim(phone)) > 0
  AND ((expected_user_id IS NULL AND expected_profile_revision IS NULL)
    OR (expected_user_id IS NOT NULL AND expected_profile_revision IS NOT NULL AND expected_profile_revision > 0))
  AND ((lease_token IS NULL AND locked_until IS NULL) OR (lease_token IS NOT NULL AND locked_until IS NOT NULL))
  AND ((status = 'pending' AND result_user_id IS NULL AND result_profile_revision IS NULL AND error_code IS NULL AND processed_at IS NULL)
    OR (status = 'completed' AND result_user_id IS NOT NULL AND result_profile_revision IS NOT NULL AND result_profile_revision > 0 AND error_code IS NULL AND processed_at IS NOT NULL AND lease_token IS NULL)
    OR (status = 'rejected' AND result_user_id IS NULL AND result_profile_revision IS NULL AND error_code IS NOT NULL AND processed_at IS NOT NULL AND lease_token IS NULL))
);
ALTER TABLE consent_revisions ADD CONSTRAINT consent_revision_artifacts CHECK (
  octet_length(document_bytes) > 0 AND octet_length(form_snapshot_bytes) > 0
  AND document_sha256 = encode(sha256(document_bytes), 'hex')
  AND form_sha256 = encode(sha256(form_snapshot_bytes), 'hex')
  AND length(purpose) > 0 AND length(version) > 0 AND length(document_title) > 0
  AND (published_at IS NULL OR published_at >= created_at)
  AND (retired_at IS NULL OR (published_at IS NOT NULL AND retired_at >= published_at))
);
ALTER TABLE user_consent_states ADD CONSTRAINT user_consent_state_v1 CHECK (
  contract_version = 1 AND revision > 0 AND jsonb_typeof(required_acceptances) = 'array'
);
CREATE FUNCTION _consent_decisions_v1(decisions jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN jsonb_typeof(decisions) = 'array' THEN
    jsonb_array_length(decisions) > 0 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(decisions) AS item
      WHERE jsonb_typeof(item) IS DISTINCT FROM 'object'
        OR jsonb_typeof(item->'revisionId') IS DISTINCT FROM 'string'
        OR length(item->>'revisionId') = 0
        OR jsonb_typeof(item->'accepted') IS DISTINCT FROM 'boolean'
    ) AND (SELECT count(DISTINCT item->>'revisionId') FROM jsonb_array_elements(decisions) AS item)
      = jsonb_array_length(decisions)
  ELSE false END;
$$;
ALTER TABLE apply_consent_decision_commands ADD CONSTRAINT consent_command_v1 CHECK (
  contract_version = 1 AND payload_hash ~ '^[0-9a-f]{64}$' AND attempts >= 0
  AND expected_state_revision >= 0 AND expected_advertising_version >= 0
  AND _consent_decisions_v1(decisions)
  AND length(request_id) > 0 AND (source IS NULL OR length(btrim(source)) > 0)
  AND _request_evidence_v1(request_context)
  AND ((lease_token IS NULL AND locked_until IS NULL) OR (lease_token IS NOT NULL AND locked_until IS NOT NULL))
  AND ((status = 'pending' AND result_state_revision IS NULL AND error_code IS NULL AND processed_at IS NULL)
    OR (status = 'completed' AND result_state_revision IS NOT NULL AND result_state_revision > 0 AND error_code IS NULL AND processed_at IS NOT NULL AND lease_token IS NULL)
    OR (status = 'rejected' AND result_state_revision IS NULL AND error_code IS NOT NULL AND processed_at IS NOT NULL AND lease_token IS NULL))
);
ALTER TABLE required_consent_acceptances ADD CONSTRAINT required_consent_evidence CHECK (
  length(request_id) > 0 AND (source IS NULL OR length(btrim(source)) > 0)
  AND _request_evidence_v1(request_context)
);
ALTER TABLE email_advertising_subscriptions ADD CONSTRAINT advertising_subscription_state CHECK (
  recipient_key ~ '^[0-9a-f]{64}$' AND length(key_version) > 0 AND version >= 0
  AND ((state = 'revoked' AND active_grant_id IS NULL)
    OR (state = 'active' AND active_grant_id IS NOT NULL AND email IS NOT NULL AND version > 0))
);
ALTER TABLE email_advertising_consent_events ADD CONSTRAINT advertising_event_action CHECK (
  version > 0 AND payload_hash ~ '^[0-9a-f]{64}$' AND length(operation_key) > 0
  AND length(request_id) > 0 AND _request_evidence_v1(request_context)
  AND (source IS NULL OR length(btrim(source)) > 0)
  AND ((auth_operation_id IS NULL AND identity_fact_id IS NULL)
    OR (auth_operation_id IS NOT NULL AND identity_fact_id IS NOT NULL))
  AND ((action = 'granted' AND auth_operation_id IS NOT NULL AND identity_fact_id IS NOT NULL
      AND revision_id IS NOT NULL)
    OR (action = 'revoked' AND revision_id IS NULL))
);

CREATE FUNCTION _consent_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Evidence is append-only: %', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER verified_identity_immutable BEFORE UPDATE OR DELETE ON verified_identity_facts
  FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();
CREATE TRIGGER required_consent_immutable BEFORE UPDATE OR DELETE ON required_consent_acceptances
  FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();
CREATE TRIGGER advertising_event_immutable BEFORE UPDATE OR DELETE ON email_advertising_consent_events
  FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();

CREATE FUNCTION _consent_revision_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Consent revisions are retained' USING ERRCODE = '55000';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['published_at', 'retired_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['published_at', 'retired_at'])
     OR (OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at)
     OR (OLD.retired_at IS NOT NULL AND NEW.retired_at IS DISTINCT FROM OLD.retired_at) THEN
    RAISE EXCEPTION 'Consent revision content and publication history are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER consent_revision_immutable BEFORE UPDATE OR DELETE ON consent_revisions
  FOR EACH ROW EXECUTE FUNCTION _consent_revision_immutable();

-- Stable intent and terminal results cannot be rewritten by a retry. Owner
-- handlers still need transactional claims, fencing and domain validation.
CREATE FUNCTION _auth_flow_intent_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mutable_fields text[];
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Operation receipts are retained' USING ERRCODE = '55000';
  END IF;
  IF TG_TABLE_NAME = 'auth_completion_operations' THEN
    mutable_fields := ARRAY['status', 'result_user_id', 'error_code', 'finished_at', 'updated_at'];
  ELSIF TG_TABLE_NAME = 'ensure_customer_profile_commands' THEN
    mutable_fields := ARRAY['status', 'attempts', 'lease_token', 'locked_until', 'available_at',
      'result_user_id', 'result_profile_revision', 'error_code', 'processed_at'];
  ELSE
    mutable_fields := ARRAY['status', 'attempts', 'lease_token', 'locked_until', 'available_at',
      'result_state_revision', 'error_code', 'processed_at'];
  END IF;
  IF OLD.status::text <> 'pending' OR
    (to_jsonb(NEW) - mutable_fields) IS DISTINCT FROM (to_jsonb(OLD) - mutable_fields) THEN
    RAISE EXCEPTION 'Operation intent and terminal results are immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auth_completion_intent BEFORE UPDATE OR DELETE ON auth_completion_operations
  FOR EACH ROW EXECUTE FUNCTION _auth_flow_intent_immutable();
CREATE TRIGGER profile_command_intent BEFORE UPDATE OR DELETE ON ensure_customer_profile_commands
  FOR EACH ROW EXECUTE FUNCTION _auth_flow_intent_immutable();
CREATE TRIGGER consent_command_intent BEFORE UPDATE OR DELETE ON apply_consent_decision_commands
  FOR EACH ROW EXECUTE FUNCTION _auth_flow_intent_immutable();

CREATE FUNCTION _auth_pending_operation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.current_operation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM auth_completion_operations o WHERE o.id = NEW.current_operation_id
      AND o.flow_id = NEW.id AND o.identity_fact_id = NEW.identity_fact_id AND o.purpose = NEW.purpose
  ) THEN
    RAISE EXCEPTION 'Pending flow operation binding mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER auth_pending_operation_binding BEFORE INSERT OR UPDATE ON auth_pending_flows
  FOR EACH ROW EXECUTE FUNCTION _auth_pending_operation_binding();

CREATE FUNCTION _required_consent_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM consent_revisions r
    JOIN auth_completion_operations o ON o.id = NEW.operation_id AND o.identity_fact_id = NEW.identity_fact_id
    JOIN verified_identity_facts i ON i.id = o.identity_fact_id
    WHERE r.id = NEW.revision_id AND r.kind = 'personal_data' AND r.purpose = NEW.purpose
      AND o.purpose = NEW.purpose AND o.status = 'pending' AND i.email = NEW.email
      AND i.verified_at <= NEW.accepted_at
      AND r.published_at <= NEW.accepted_at AND (r.retired_at IS NULL OR r.retired_at > NEW.accepted_at)
  ) THEN
    RAISE EXCEPTION 'Required consent revision/identity mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER required_consent_binding BEFORE INSERT ON required_consent_acceptances
  FOR EACH ROW EXECUTE FUNCTION _required_consent_binding();

CREATE FUNCTION _advertising_event_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_subscription email_advertising_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO current_subscription FROM email_advertising_subscriptions
    WHERE id = NEW.subscription_id FOR UPDATE;
  IF NOT FOUND OR NEW.version <> current_subscription.version + 1 OR
    current_subscription.email IS DISTINCT FROM NEW.email THEN
    RAISE EXCEPTION 'Advertising event subject/version mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.action = 'granted' AND NOT EXISTS (
    SELECT 1 FROM consent_revisions r
    JOIN auth_completion_operations o ON o.id = NEW.auth_operation_id AND o.identity_fact_id = NEW.identity_fact_id
    JOIN verified_identity_facts i ON i.id = o.identity_fact_id
    WHERE r.id = NEW.revision_id AND r.kind = 'email_advertising' AND r.purpose = o.purpose
      AND o.status = 'pending' AND i.email = NEW.email AND i.verified_at <= NEW.occurred_at
      AND r.published_at <= NEW.occurred_at
      AND (r.retired_at IS NULL OR r.retired_at > NEW.occurred_at)
  ) THEN
    RAISE EXCEPTION 'Advertising grant revision/identity mismatch' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER advertising_event_binding BEFORE INSERT ON email_advertising_consent_events
  FOR EACH ROW EXECUTE FUNCTION _advertising_event_binding();

CREATE FUNCTION _advertising_permission_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE latest_event email_advertising_consent_events%ROWTYPE;
BEGIN
  SELECT * INTO latest_event FROM email_advertising_consent_events
    WHERE subscription_id = NEW.id ORDER BY version DESC LIMIT 1;
  IF NOT FOUND THEN
    IF NEW.version <> 0 OR NEW.state <> 'revoked' THEN
      RAISE EXCEPTION 'Permission requires a consent event' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW.version <> latest_event.version OR
    (NEW.state = 'active' AND (latest_event.action <> 'granted' OR
      NEW.active_grant_id IS DISTINCT FROM latest_event.id OR NEW.email IS DISTINCT FROM latest_event.email)) OR
    (NEW.state = 'revoked' AND latest_event.action <> 'revoked') THEN
    RAISE EXCEPTION 'Permission does not match the latest consent event' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER advertising_permission_binding BEFORE INSERT OR UPDATE ON email_advertising_subscriptions
  FOR EACH ROW EXECUTE FUNCTION _advertising_permission_binding();

-- An event and the authoritative permission must commit together. In particular,
-- a committed revoke cannot leave permission active until a later async update.
CREATE FUNCTION _advertising_event_projection_committed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM email_advertising_subscriptions s
    JOIN LATERAL (
      SELECT * FROM email_advertising_consent_events e
      WHERE e.subscription_id = s.id ORDER BY e.version DESC LIMIT 1
    ) latest ON true
    WHERE s.id = NEW.subscription_id AND s.version = latest.version AND
      ((latest.action = 'revoked' AND s.state = 'revoked' AND s.active_grant_id IS NULL)
       OR (latest.action = 'granted' AND s.state = 'active' AND s.active_grant_id = latest.id AND s.email = latest.email))
  ) THEN
    RAISE EXCEPTION 'Consent event and permission must commit together' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER advertising_event_projection_committed
  AFTER INSERT ON email_advertising_consent_events DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION _advertising_event_projection_committed();

ALTER TABLE email_advertising_delivery_attempts ADD CONSTRAINT advertising_attempt_evidence CHECK (
  attempt_number > 0 AND length(logical_send_id) > 0 AND length(sender) > 0 AND length(message_id) > 0
  AND octet_length(message_bytes) > 0 AND message_sha256 = encode(sha256(message_bytes), 'hex')
  AND ((outcome = 'pending' AND finished_at IS NULL AND provider_receipt_id IS NULL AND outcome_code IS NULL)
    OR (outcome <> 'pending' AND finished_at IS NOT NULL AND finished_at >= started_at))
  AND (provider_receipt_id IS NULL OR outcome = 'accepted')
);
ALTER TABLE email_advertising_access_events ADD CONSTRAINT advertising_access_evidence CHECK (
  length(actor_user_id_snapshot) > 0 AND length(operation_key) > 0
  AND _request_evidence_v1(request_context)
  AND length(btrim(reason)) > 0 AND length(request_id) > 0
);
CREATE TRIGGER advertising_access_immutable BEFORE UPDATE OR DELETE ON email_advertising_access_events
  FOR EACH ROW EXECUTE FUNCTION _consent_evidence_immutable();

CREATE FUNCTION _advertising_attempt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM email_advertising_consent_events e
    WHERE e.id = NEW.grant_event_id AND e.action = 'granted' AND e.email = NEW.email) THEN
    RAISE EXCEPTION 'Delivery attempt requires the exact grant recipient' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER advertising_attempt_binding BEFORE INSERT ON email_advertising_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION _advertising_attempt_binding();

CREATE FUNCTION _advertising_attempt_result() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Delivery attempt evidence is retained' USING ERRCODE = '55000';
  END IF;
  IF OLD.outcome <> 'pending' OR NEW.outcome = 'pending' OR
    (to_jsonb(NEW) - ARRAY['outcome', 'provider_receipt_id', 'outcome_code', 'finished_at']) IS DISTINCT FROM
    (to_jsonb(OLD) - ARRAY['outcome', 'provider_receipt_id', 'outcome_code', 'finished_at']) THEN
    RAISE EXCEPTION 'Only a pending attempt result may be completed' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER advertising_attempt_result BEFORE UPDATE OR DELETE ON email_advertising_delivery_attempts
  FOR EACH ROW EXECUTE FUNCTION _advertising_attempt_result();

COMMIT;
