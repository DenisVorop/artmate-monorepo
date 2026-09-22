-- Telegram settings moved out of the account dashboard.
-- Preserve custom destinations configured by administrators.
UPDATE "feature_banners"
SET "cta_href" = '/account/settings', "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'telegram-link' AND "cta_href" = '/account';
