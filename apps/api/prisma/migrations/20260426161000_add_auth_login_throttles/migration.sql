CREATE TYPE "auth_login_throttle_scope" AS ENUM ('login', 'ip');

CREATE TABLE "auth_login_throttles" (
    "id" TEXT NOT NULL,
    "scope" "auth_login_throttle_scope" NOT NULL,
    "subject_hash" VARCHAR(64) NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "first_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_login_throttles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_login_throttles_scope_subject_hash_key" ON "auth_login_throttles"("scope", "subject_hash");

CREATE INDEX "auth_login_throttles_locked_until_idx" ON "auth_login_throttles"("locked_until");
