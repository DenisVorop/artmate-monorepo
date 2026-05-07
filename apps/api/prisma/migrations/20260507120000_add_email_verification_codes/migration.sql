-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Existing accounts predate required email verification, so keep them usable.
UPDATE "users"
SET "email_verified_at" = "created_at"
WHERE "email_verified_at" IS NULL;

-- CreateTable
CREATE TABLE "auth_email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "ip_address" VARCHAR(45),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_email_verification_codes_user_id_idx" ON "auth_email_verification_codes"("user_id");

-- CreateIndex
CREATE INDEX "auth_email_verification_codes_expires_at_idx" ON "auth_email_verification_codes"("expires_at");

-- CreateIndex
CREATE INDEX "auth_email_verification_codes_sent_at_idx" ON "auth_email_verification_codes"("sent_at");

-- CreateIndex
CREATE INDEX "auth_email_verification_codes_ip_address_sent_at_idx" ON "auth_email_verification_codes"("ip_address", "sent_at");

-- AddForeignKey
ALTER TABLE "auth_email_verification_codes" ADD CONSTRAINT "auth_email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
