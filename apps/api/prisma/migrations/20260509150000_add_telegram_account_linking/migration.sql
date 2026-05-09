-- AlterTable
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(80);

-- CreateTable
CREATE TABLE "telegram_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "telegram_user_id" VARCHAR(80) NOT NULL,
    "telegram_chat_id" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(80) NOT NULL,
    "username" VARCHAR(80),
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_telegram_link_codes" (
    "id" TEXT NOT NULL,
    "telegram_user_id" VARCHAR(80) NOT NULL,
    "telegram_chat_id" VARCHAR(80) NOT NULL,
    "phone" VARCHAR(80) NOT NULL,
    "username" VARCHAR(80),
    "first_name" VARCHAR(120),
    "last_name" VARCHAR(120),
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_telegram_link_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_user_id_key" ON "telegram_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_accounts_telegram_user_id_key" ON "telegram_accounts"("telegram_user_id");

-- CreateIndex
CREATE INDEX "telegram_accounts_user_id_idx" ON "telegram_accounts"("user_id");

-- CreateIndex
CREATE INDEX "auth_telegram_link_codes_telegram_user_id_idx" ON "auth_telegram_link_codes"("telegram_user_id");

-- CreateIndex
CREATE INDEX "auth_telegram_link_codes_code_hash_idx" ON "auth_telegram_link_codes"("code_hash");

-- CreateIndex
CREATE INDEX "auth_telegram_link_codes_expires_at_idx" ON "auth_telegram_link_codes"("expires_at");

-- CreateIndex
CREATE INDEX "auth_telegram_link_codes_sent_at_idx" ON "auth_telegram_link_codes"("sent_at");

-- AddForeignKey
ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
