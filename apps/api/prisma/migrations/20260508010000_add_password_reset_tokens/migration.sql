-- CreateTable
CREATE TABLE "auth_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip_address" VARCHAR(45),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_password_reset_tokens_token_hash_key" ON "auth_password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_password_reset_tokens_user_id_idx" ON "auth_password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "auth_password_reset_tokens_expires_at_idx" ON "auth_password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "auth_password_reset_tokens_ip_address_sent_at_idx" ON "auth_password_reset_tokens"("ip_address", "sent_at");

-- CreateIndex
CREATE INDEX "auth_password_reset_tokens_sent_at_idx" ON "auth_password_reset_tokens"("sent_at");

-- AddForeignKey
ALTER TABLE "auth_password_reset_tokens" ADD CONSTRAINT "auth_password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
