BEGIN;

-- Local uploads use the existing API public base URL, including HTTP in local dev.
ALTER TABLE "loyalty_achievement_revisions"
  DROP CONSTRAINT "loyalty_achievement_revisions_image_url_check";
ALTER TABLE "loyalty_achievement_revisions"
  ADD CONSTRAINT "loyalty_achievement_revisions_image_url_check"
  CHECK ("image_url" IS NULL OR "image_url" ~ '^https?://[^[:space:]]+$');

COMMIT;
