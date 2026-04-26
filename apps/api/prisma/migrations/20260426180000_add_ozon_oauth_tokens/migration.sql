CREATE TABLE "ozon_oauth_tokens" (
    "id" TEXT NOT NULL,
    "token_key" VARCHAR(64) NOT NULL DEFAULT 'default',
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "scope" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "token_type" VARCHAR(32),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ozon_oauth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ozon_oauth_tokens_token_key_key" ON "ozon_oauth_tokens"("token_key");

CREATE INDEX "ozon_oauth_tokens_expires_at_idx" ON "ozon_oauth_tokens"("expires_at");
