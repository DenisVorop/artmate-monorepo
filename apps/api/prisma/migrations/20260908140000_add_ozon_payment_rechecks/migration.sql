CREATE TABLE "order_ozon_payment_rechecks" (
    "order_id" VARCHAR(32) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL,
    "lease_token" UUID,
    "locked_until" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "last_authoritative_status" VARCHAR(120),
    "last_error" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_ozon_payment_rechecks_pkey" PRIMARY KEY ("order_id"),
    CONSTRAINT "order_ozon_payment_rechecks_attempts_check"
        CHECK ("attempts" >= 0),
    CONSTRAINT "order_ozon_payment_rechecks_lease_check"
        CHECK (
            ("lease_token" IS NULL AND "locked_until" IS NULL)
            OR ("lease_token" IS NOT NULL AND "locked_until" IS NOT NULL)
        ),
    CONSTRAINT "order_ozon_payment_rechecks_last_error_check"
        CHECK ("last_error" IS NULL OR "last_error" ~ '^[a-z0-9_]+$'),
    CONSTRAINT "order_ozon_payment_rechecks_order_id_fkey"
        FOREIGN KEY ("order_id") REFERENCES "orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "order_ozon_payment_rechecks_due_idx"
ON "order_ozon_payment_rechecks"("finished_at", "next_attempt_at", "locked_until");
