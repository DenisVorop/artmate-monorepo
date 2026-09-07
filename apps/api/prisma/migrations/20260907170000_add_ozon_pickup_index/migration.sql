CREATE TYPE "ozon_pickup_index_generation_status" AS ENUM (
    'building',
    'ready',
    'published',
    'failed'
);

CREATE TABLE "ozon_pickup_index_generations" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "status" "ozon_pickup_index_generation_status" NOT NULL DEFAULT 'building',
    "lease_slot" VARCHAR(32),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ready_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "source_point_count" INTEGER NOT NULL DEFAULT 0,
    "eligible_point_count" INTEGER NOT NULL DEFAULT 0,
    "excluded_point_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ozon_pickup_index_generations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ozon_pickup_index_generations_id_nonblank_check"
        CHECK (btrim("id") <> ''),
    CONSTRAINT "ozon_pickup_index_generations_lease_slot_check"
        CHECK (
            (
                "status" = 'building'
                AND "lease_slot" IS NOT NULL
                AND "lease_slot" = 'global'
            )
            OR ("status" <> 'building' AND "lease_slot" IS NULL)
        ),
    CONSTRAINT "ozon_pickup_index_generations_lifecycle_check" CHECK (
        (
            "status" = 'building'
            AND "ready_at" IS NULL
            AND "published_at" IS NULL
        )
        OR (
            "status" = 'ready'
            AND "ready_at" IS NOT NULL
            AND "published_at" IS NULL
        )
        OR (
            "status" = 'published'
            AND "ready_at" IS NOT NULL
            AND "published_at" IS NOT NULL
        )
        OR ("status" = 'failed' AND "published_at" IS NULL)
    ),
    CONSTRAINT "ozon_pickup_index_generations_timestamp_order_check" CHECK (
        "heartbeat_at" >= "started_at"
        AND ("ready_at" IS NULL OR "ready_at" >= "started_at")
        AND (
            "status" NOT IN ('ready', 'published')
            OR "ready_at" >= "heartbeat_at"
        )
        AND (
            "published_at" IS NULL
            OR (
                "ready_at" IS NOT NULL
                AND "published_at" >= "ready_at"
            )
        )
    ),
    CONSTRAINT "ozon_pickup_index_generations_counts_check" CHECK (
        "source_point_count"::bigint >= 0
        AND "eligible_point_count"::bigint >= 0
        AND "excluded_point_count"::bigint >= 0
        AND (
            (
                "status" IN ('building', 'failed')
                AND "eligible_point_count"::bigint + "excluded_point_count"::bigint
                    <= "source_point_count"::bigint
            )
            OR (
                "status" IN ('ready', 'published')
                AND "eligible_point_count"::bigint + "excluded_point_count"::bigint
                    = "source_point_count"::bigint
            )
        )
    )
);

CREATE TABLE "ozon_localities" (
    "id" TEXT NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "region" VARCHAR(160) NOT NULL,
    "name_normalized" VARCHAR(160) NOT NULL,
    "region_normalized" VARCHAR(160) NOT NULL,

    CONSTRAINT "ozon_localities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ozon_localities_nonblank_check" CHECK (
        btrim("id") <> ''
        AND btrim("name") <> ''
        AND btrim("region") <> ''
        AND btrim("name_normalized") <> ''
        AND btrim("region_normalized") <> ''
    ),
    CONSTRAINT "ozon_localities_country_code_check"
        CHECK ("country_code" ~ '^[A-Z]{2}$')
);

CREATE TABLE "ozon_pickup_point_snapshots" (
    "generation_id" TEXT NOT NULL,
    "map_point_id" VARCHAR(160) NOT NULL,
    "locality_id" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "address" TEXT NOT NULL,
    "work_hours" VARCHAR(120) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ozon_pickup_point_snapshots_pkey"
        PRIMARY KEY ("generation_id", "map_point_id"),
    CONSTRAINT "ozon_pickup_point_snapshots_latitude_check"
        CHECK ("latitude" BETWEEN -90 AND 90),
    CONSTRAINT "ozon_pickup_point_snapshots_longitude_check"
        CHECK ("longitude" BETWEEN -180 AND 180),
    CONSTRAINT "ozon_pickup_point_snapshots_nonblank_check" CHECK (
        btrim("generation_id") <> ''
        AND btrim("map_point_id") <> ''
        AND btrim("locality_id") <> ''
        AND btrim("title") <> ''
        AND btrim("address") <> ''
        AND btrim("work_hours") <> ''
    )
);

CREATE UNIQUE INDEX "ozon_pickup_index_generations_lease_slot_key"
ON "ozon_pickup_index_generations"("lease_slot");

CREATE UNIQUE INDEX "ozon_pickup_index_generations_sequence_key"
ON "ozon_pickup_index_generations"("sequence");

CREATE INDEX "ozon_pickup_index_generations_status_sequence_id_idx"
ON "ozon_pickup_index_generations"("status", "sequence" DESC, "id" DESC);

CREATE UNIQUE INDEX "ozon_localities_country_code_region_normalized_name_normalized_key"
ON "ozon_localities"("country_code", "region_normalized", "name_normalized");

CREATE INDEX "ozon_localities_country_code_name_normalized_prefix_idx"
ON "ozon_localities"("country_code", "name_normalized" varchar_pattern_ops);

CREATE INDEX "ozon_pickup_point_snapshots_generation_id_locality_id_idx"
ON "ozon_pickup_point_snapshots"("generation_id", "locality_id");

CREATE INDEX "ozon_pickup_point_snapshots_locality_id_idx"
ON "ozon_pickup_point_snapshots"("locality_id");

ALTER TABLE "ozon_pickup_point_snapshots"
ADD CONSTRAINT "ozon_pickup_point_snapshots_generation_id_fkey"
FOREIGN KEY ("generation_id") REFERENCES "ozon_pickup_index_generations"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ozon_pickup_point_snapshots"
ADD CONSTRAINT "ozon_pickup_point_snapshots_locality_id_fkey"
FOREIGN KEY ("locality_id") REFERENCES "ozon_localities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
