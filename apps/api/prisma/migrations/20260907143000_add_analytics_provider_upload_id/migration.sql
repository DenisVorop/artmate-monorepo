ALTER TABLE "analytics_outbox_events"
ADD COLUMN "provider_upload_id" VARCHAR(128),
ADD COLUMN "lease_token" VARCHAR(36);

CREATE UNIQUE INDEX "analytics_outbox_events_provider_upload_id_key"
ON "analytics_outbox_events"("provider_upload_id");
