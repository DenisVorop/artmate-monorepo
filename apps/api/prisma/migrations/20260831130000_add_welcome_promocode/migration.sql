BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "promo_codes" WHERE "code" = 'ARTMSTART') THEN
    RAISE EXCEPTION 'Cannot seed welcome promo: ARTMSTART already exists';
  END IF;
END
$$;

CREATE TYPE "promo_code_kind" AS ENUM ('standard', 'welcome');

ALTER TABLE "promo_codes"
  ADD COLUMN "kind" "promo_code_kind" NOT NULL DEFAULT 'standard',
  ADD CONSTRAINT "promo_codes_welcome_per_user_check" CHECK (
    "kind" <> 'welcome' OR "max_uses_per_user" IS NOT DISTINCT FROM 1
  );

CREATE UNIQUE INDEX "promo_codes_single_welcome_key"
  ON "promo_codes" ("kind")
  WHERE "kind" = 'welcome';

INSERT INTO "promo_codes" (
  "id",
  "code",
  "kind",
  "name",
  "type",
  "basis_points",
  "min_subtotal_kopecks",
  "max_uses_per_user"
) VALUES (
  'welcome-artmstart',
  'ARTMSTART',
  'welcome',
  'Приветственный промокод',
  'percentage',
  2000,
  0,
  1
);

COMMIT;
