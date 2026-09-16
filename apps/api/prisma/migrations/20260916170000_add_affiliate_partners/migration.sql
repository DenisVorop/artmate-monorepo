ALTER TYPE "user_role" ADD VALUE 'partner';

CREATE TYPE "affiliate_partner_status" AS ENUM ('active', 'suspended');

CREATE TABLE "affiliate_partners" (
  "id" VARCHAR(32) NOT NULL,
  "user_id" TEXT NOT NULL,
  "partner_application_id" VARCHAR(32),
  "status" "affiliate_partner_status" NOT NULL DEFAULT 'active',
  "minimum_payout_kopecks" BIGINT,
  "contract_number" VARCHAR(120) NOT NULL,
  "contract_signed_at" TIMESTAMP(3) NOT NULL,
  "contract_payment_details" TEXT NOT NULL,
  "contract_version" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "affiliate_partners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_partners_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "affiliate_partners_partner_application_id_key" UNIQUE ("partner_application_id"),
  CONSTRAINT "affiliate_partners_minimum_payout_kopecks_check" CHECK (
    "minimum_payout_kopecks" IS NULL
    OR "minimum_payout_kopecks" BETWEEN 1 AND 9007199254740991
  ),
  CONSTRAINT "affiliate_partners_contract_number_check" CHECK (length(btrim("contract_number")) > 0),
  CONSTRAINT "affiliate_partners_contract_payment_details_check" CHECK (length(btrim("contract_payment_details")) > 0),
  CONSTRAINT "affiliate_partners_contract_version_check" CHECK ("contract_version" > 0),
  CONSTRAINT "affiliate_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "affiliate_partners_partner_application_id_fkey" FOREIGN KEY ("partner_application_id") REFERENCES "partner_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "affiliate_partners_status_created_at_idx"
  ON "affiliate_partners"("status", "created_at");

CREATE TABLE "affiliate_contract_revisions" (
  "id" VARCHAR(32) NOT NULL,
  "partner_id" VARCHAR(32) NOT NULL,
  "version" INTEGER NOT NULL,
  "number" VARCHAR(120) NOT NULL,
  "signed_at" TIMESTAMP(3) NOT NULL,
  "payment_details" TEXT NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changed_by_user_id" TEXT NOT NULL,

  CONSTRAINT "affiliate_contract_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_contract_revisions_partner_id_version_key" UNIQUE ("partner_id", "version"),
  CONSTRAINT "affiliate_contract_revisions_version_check" CHECK ("version" > 0),
  CONSTRAINT "affiliate_contract_revisions_number_check" CHECK (length(btrim("number")) > 0),
  CONSTRAINT "affiliate_contract_revisions_payment_details_check" CHECK (length(btrim("payment_details")) > 0),
  CONSTRAINT "affiliate_contract_revisions_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "affiliate_contract_revisions_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX "affiliate_contract_revisions_partner_id_changed_at_idx"
  ON "affiliate_contract_revisions"("partner_id", "changed_at");
CREATE INDEX "affiliate_contract_revisions_changed_by_user_id_idx"
  ON "affiliate_contract_revisions"("changed_by_user_id");

CREATE FUNCTION "protect_affiliate_contract_revision"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'affiliate contract revision is immutable';
END;
$$;

CREATE TRIGGER "affiliate_contract_revisions_immutable"
BEFORE UPDATE OR DELETE ON "affiliate_contract_revisions"
FOR EACH ROW EXECUTE FUNCTION "protect_affiliate_contract_revision"();
