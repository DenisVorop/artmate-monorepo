-- CreateTable
CREATE TABLE "order_shipments" (
    "id" TEXT NOT NULL,
    "order_id" VARCHAR(32) NOT NULL,
    "provider" "order_delivery_provider" NOT NULL,
    "external_uuid" VARCHAR(120),
    "external_number" VARCHAR(120),
    "request_uuid" VARCHAR(120),
    "request_state" VARCHAR(40),
    "status_code" VARCHAR(80),
    "status_name" VARCHAR(160),
    "error_message" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_shipments_order_id_provider_key" ON "order_shipments"("order_id", "provider");

-- CreateIndex
CREATE INDEX "order_shipments_provider_request_state_idx" ON "order_shipments"("provider", "request_state");

-- CreateIndex
CREATE INDEX "order_shipments_external_uuid_idx" ON "order_shipments"("external_uuid");

-- AddForeignKey
ALTER TABLE "order_shipments" ADD CONSTRAINT "order_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
