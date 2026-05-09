CREATE TYPE "feature_banner_audience" AS ENUM ('all', 'authenticated', 'anonymous', 'telegram_unlinked');

CREATE TYPE "feature_banner_tone" AS ENUM ('info', 'success', 'warning');

CREATE TABLE "feature_banners" (
  "id" VARCHAR(32) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT NOT NULL,
  "cta_label" VARCHAR(80),
  "cta_href" TEXT,
  "audience" "feature_banner_audience" NOT NULL DEFAULT 'all',
  "tone" "feature_banner_tone" NOT NULL DEFAULT 'info',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feature_banners_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_banners_slug_key" ON "feature_banners"("slug");
CREATE INDEX "feature_banners_enabled_archived_at_sort_order_idx" ON "feature_banners"("enabled", "archived_at", "sort_order");
CREATE INDEX "feature_banners_audience_enabled_idx" ON "feature_banners"("audience", "enabled");

INSERT INTO "feature_banners" (
  "id",
  "slug",
  "title",
  "description",
  "cta_label",
  "cta_href",
  "audience",
  "tone",
  "enabled",
  "sort_order"
) VALUES (
  'system-telegram-link',
  'telegram-link',
  'Подключите Telegram',
  'Будем присылать обновления по заказам в удобный чат.',
  'Подключить',
  '/account',
  'telegram_unlinked',
  'info',
  true,
  10
);
