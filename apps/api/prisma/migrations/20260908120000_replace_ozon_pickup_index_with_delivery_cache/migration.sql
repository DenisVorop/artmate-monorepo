DROP TABLE IF EXISTS "ozon_pickup_point_snapshots";
DROP TABLE IF EXISTS "ozon_localities";
DROP TABLE IF EXISTS "ozon_pickup_index_generations";
DROP TYPE IF EXISTS "ozon_pickup_index_generation_status";

CREATE TABLE "delivery_cache_entries" (
    "key" VARCHAR(200) NOT NULL,
    "payload" JSONB,
    "byte_size" INTEGER NOT NULL DEFAULT 0,
    "refreshed_at" TIMESTAMP(3),
    "fresh_until" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "lease_token" UUID,
    "lease_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_cache_entries_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "delivery_cache_entries_key_nonblank_check" CHECK (btrim("key") <> ''),
    CONSTRAINT "delivery_cache_entries_byte_size_check" CHECK (
        "byte_size" >= 0
        AND (
            "byte_size" <= 5242880
            OR ("key" = 'ozon:point-list' AND "byte_size" <= 33554432)
        )
    ),
    CONSTRAINT "delivery_cache_entries_payload_check" CHECK (
        ("payload" IS NULL AND "refreshed_at" IS NULL AND "fresh_until" IS NULL AND "expires_at" IS NULL)
        OR (
            "payload" IS NOT NULL
            AND "refreshed_at" IS NOT NULL
            AND "fresh_until" IS NOT NULL
            AND "expires_at" IS NOT NULL
            AND "refreshed_at" <= "fresh_until"
            AND "fresh_until" <= "expires_at"
        )
    ),
    CONSTRAINT "delivery_cache_entries_lease_check" CHECK (
        ("lease_token" IS NULL AND "lease_until" IS NULL)
        OR ("lease_token" IS NOT NULL AND "lease_until" IS NOT NULL)
    )
);

CREATE INDEX "delivery_cache_entries_expires_at_idx"
ON "delivery_cache_entries"("expires_at");
CREATE INDEX "delivery_cache_entries_refreshed_at_idx"
ON "delivery_cache_entries"("refreshed_at");

CREATE TABLE "nominatim_rate_limits" (
    "key" VARCHAR(32) NOT NULL,
    "next_allowed_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nominatim_rate_limits_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "nominatim_rate_limits_key_nonblank_check" CHECK (btrim("key") <> '')
);
