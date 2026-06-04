CREATE TYPE "notification_job_channel" AS ENUM ('email', 'telegram');

CREATE TYPE "notification_job_status" AS ENUM ('pending', 'processing', 'sent', 'failed');

CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "channel" "notification_job_channel" NOT NULL,
    "status" "notification_job_status" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_jobs_status_next_attempt_at_created_at_idx" ON "notification_jobs"("status", "next_attempt_at", "created_at");
