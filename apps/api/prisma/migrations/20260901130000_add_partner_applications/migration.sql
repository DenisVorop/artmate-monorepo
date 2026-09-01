CREATE TYPE "partner_application_status" AS ENUM ('new', 'contacted', 'approved', 'rejected');
CREATE TYPE "partner_application_preferred_contact" AS ENUM ('email', 'telegram');
CREATE TYPE "partner_application_type" AS ENUM ('creator', 'artist', 'educator', 'studio', 'retailer', 'other');
CREATE TYPE "partner_application_audience_size" AS ENUM ('up_to_1000', '1000_10000', '10000_50000', '50000_plus');

CREATE TABLE "partner_applications" (
  "id" VARCHAR(32) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "preferred_contact" "partner_application_preferred_contact" NOT NULL,
  "contact_handle" VARCHAR(120),
  "channel_url" TEXT NOT NULL,
  "partner_type" "partner_application_type" NOT NULL,
  "audience_size" "partner_application_audience_size" NOT NULL,
  "comment" TEXT,
  "consent" BOOLEAN NOT NULL,
  "utm_source" VARCHAR(200),
  "utm_medium" VARCHAR(200),
  "utm_campaign" VARCHAR(200),
  "utm_content" VARCHAR(200),
  "utm_term" VARCHAR(200),
  "status" "partner_application_status" NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "partner_applications_consent_check" CHECK ("consent" = true),
  CONSTRAINT "partner_applications_telegram_contact_check" CHECK (
    "preferred_contact" <> 'telegram' OR NULLIF(BTRIM("contact_handle"), '') IS NOT NULL
  )
);

CREATE INDEX "partner_applications_status_created_at_idx" ON "partner_applications"("status", "created_at");
CREATE INDEX "partner_applications_created_at_idx" ON "partner_applications"("created_at");
