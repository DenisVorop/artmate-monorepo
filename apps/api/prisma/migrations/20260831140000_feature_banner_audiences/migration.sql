BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "feature_banners" WHERE "slug" = 'welcome-bonus') THEN
    RAISE EXCEPTION 'Cannot seed feature banner: welcome-bonus already exists';
  END IF;
END
$$;

ALTER TABLE "feature_banners"
  ADD COLUMN "audiences" "feature_banner_audience"[];

UPDATE "feature_banners"
SET "audiences" = ARRAY["audience"]::"feature_banner_audience"[];

DROP INDEX "feature_banners_audience_enabled_idx";

ALTER TABLE "feature_banners"
  ALTER COLUMN "audiences" SET NOT NULL,
  ALTER COLUMN "audiences" SET DEFAULT ARRAY['all']::"feature_banner_audience"[],
  ADD CONSTRAINT "feature_banners_audiences_nonempty_check"
    CHECK (cardinality("audiences") > 0),
  ADD CONSTRAINT "feature_banners_audiences_no_nulls_check"
    CHECK (array_position("audiences", NULL) IS NULL),
  DROP COLUMN "audience";

INSERT INTO "feature_banners" (
  "id",
  "slug",
  "title",
  "description",
  "cta_label",
  "cta_href",
  "audiences",
  "tone",
  "enabled",
  "sort_order"
) VALUES (
  'system-welcome-bonus',
  'welcome-bonus',
  'Приветственный бонус',
  'Получите бонус после авторизации и привязки Telegram.',
  'Перейти в аккаунт',
  '/account',
  ARRAY['anonymous', 'telegram_unlinked']::"feature_banner_audience"[],
  'success',
  true,
  20
);

COMMIT;
