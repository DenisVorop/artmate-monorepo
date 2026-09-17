CREATE TYPE "affiliate_payout_status" AS ENUM ('pending', 'paid', 'rejected', 'cancelled');
CREATE TYPE "affiliate_payout_journal_kind" AS ENUM ('reserve', 'release', 'pay');
CREATE TYPE "affiliate_payout_operation_kind" AS ENUM ('create', 'pay', 'reject');

CREATE TABLE "affiliate_payouts" (
  "id" VARCHAR(32) PRIMARY KEY,
  "partner_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "status" "affiliate_payout_status" NOT NULL DEFAULT 'pending',
  "amount_kopecks" BIGINT NOT NULL,
  "minimum_payout_kopecks" BIGINT NOT NULL,
  "contract_version" INTEGER NOT NULL,
  "contract_number" VARCHAR(120) NOT NULL,
  "contract_signed_at" TIMESTAMP(3) NOT NULL,
  "contract_payment_details" TEXT NOT NULL,
  "paid_at" TIMESTAMP(3),
  "reference" VARCHAR(160),
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_payout_amount_check" CHECK ("amount_kopecks" BETWEEN 1 AND 9007199254740991 AND "amount_kopecks" >= "minimum_payout_kopecks"),
  CONSTRAINT "affiliate_payout_minimum_check" CHECK ("minimum_payout_kopecks" BETWEEN 1 AND 9007199254740991),
  CONSTRAINT "affiliate_payout_contract_check" CHECK ("contract_version" > 0 AND length(btrim("contract_number")) > 0 AND length(btrim("contract_payment_details")) > 0),
  CONSTRAINT "affiliate_payout_terminal_fields_check" CHECK (
    ("status" = 'pending' AND "paid_at" IS NULL AND "reference" IS NULL AND "reason" IS NULL) OR
    ("status" = 'paid' AND "paid_at" IS NOT NULL AND "reference" IS NOT NULL AND length(btrim("reference")) BETWEEN 1 AND 160 AND "reason" IS NULL) OR
    ("status" IN ('rejected', 'cancelled') AND "paid_at" IS NULL AND "reference" IS NULL AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 1000)
  )
);
CREATE INDEX "affiliate_payouts_partner_created_idx" ON "affiliate_payouts"("partner_id", "created_at");
CREATE UNIQUE INDEX "affiliate_payouts_one_pending_per_partner" ON "affiliate_payouts"("partner_id") WHERE "status" = 'pending';
CREATE UNIQUE INDEX "affiliate_payouts_partner_reference_key" ON "affiliate_payouts"("partner_id", "reference") WHERE "reference" IS NOT NULL;

CREATE FUNCTION "guard_affiliate_payout_insert"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" <> 'pending' OR NEW."paid_at" IS NOT NULL OR NEW."reference" IS NOT NULL OR NEW."reason" IS NOT NULL THEN
    RAISE EXCEPTION 'Affiliate payout must be created pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "affiliate_payout_insert_guard" BEFORE INSERT ON "affiliate_payouts"
FOR EACH ROW EXECUTE FUNCTION "guard_affiliate_payout_insert"();

CREATE TABLE "affiliate_payout_events" (
  "id" VARCHAR(32) PRIMARY KEY,
  "payout_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_payouts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "partner_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "status" "affiliate_payout_status" NOT NULL,
  "actor_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_payout_event_reason_check" CHECK (
    ("status" IN ('pending', 'paid') AND "actor_user_id" IS NOT NULL AND "reason" IS NULL) OR
    ("status" = 'rejected' AND "actor_user_id" IS NOT NULL AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 1000) OR
    ("status" = 'cancelled' AND "actor_user_id" IS NULL AND "reason" IS NOT NULL AND length(btrim("reason")) BETWEEN 1 AND 1000)
  )
);
CREATE INDEX "affiliate_payout_events_payout_created_idx" ON "affiliate_payout_events"("payout_id", "created_at");
CREATE INDEX "affiliate_payout_events_partner_created_idx" ON "affiliate_payout_events"("partner_id", "created_at");
CREATE UNIQUE INDEX "affiliate_payout_events_payout_status_key" ON "affiliate_payout_events"("payout_id", "status");

CREATE TABLE "affiliate_payout_journal_entries" (
  "id" VARCHAR(32) PRIMARY KEY,
  "payout_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_payouts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "partner_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "kind" "affiliate_payout_journal_kind" NOT NULL,
  "amount_kopecks" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_payout_journal_amount_check" CHECK ("amount_kopecks" BETWEEN 1 AND 9007199254740991),
  CONSTRAINT "affiliate_payout_journal_payout_kind_key" UNIQUE ("payout_id", "kind")
);
CREATE INDEX "affiliate_payout_journal_partner_created_idx" ON "affiliate_payout_journal_entries"("partner_id", "created_at");

CREATE TABLE "affiliate_payout_operations" (
  "id" VARCHAR(32) PRIMARY KEY,
  "payout_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_payouts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "partner_id" VARCHAR(32) NOT NULL REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  "request_id" UUID NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "kind" "affiliate_payout_operation_kind" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_payout_operation_fingerprint_check" CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "affiliate_payout_operations_partner_request_key" UNIQUE ("partner_id", "request_id")
);
CREATE INDEX "affiliate_payout_operations_payout_created_idx" ON "affiliate_payout_operations"("payout_id", "created_at");

CREATE FUNCTION "assert_affiliate_payout_child"() RETURNS trigger AS $$
DECLARE payout_row "affiliate_payouts"%ROWTYPE;
BEGIN
  SELECT * INTO payout_row FROM "affiliate_payouts" WHERE "id" = NEW."payout_id";
  IF payout_row."id" IS NULL OR payout_row."partner_id" <> NEW."partner_id" THEN
    RAISE EXCEPTION 'Affiliate payout child references do not match';
  END IF;
  IF NEW."created_at" < payout_row."created_at" THEN
    RAISE EXCEPTION 'Affiliate payout child predates payout';
  END IF;
  IF TG_TABLE_NAME = 'affiliate_payout_journal_entries' THEN
    IF NEW."amount_kopecks" <> payout_row."amount_kopecks" THEN
      RAISE EXCEPTION 'Affiliate payout journal amount does not match payout';
    END IF;
    IF (NEW."kind" = 'reserve' AND payout_row."status" <> 'pending')
      OR (NEW."kind" = 'pay' AND payout_row."status" <> 'paid')
      OR (NEW."kind" = 'release' AND payout_row."status" NOT IN ('rejected', 'cancelled')) THEN
      RAISE EXCEPTION 'Affiliate payout journal kind does not match status';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'affiliate_payout_events' THEN
    IF NEW."status" <> payout_row."status" THEN
      RAISE EXCEPTION 'Affiliate payout event status does not match payout';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "affiliate_payout_event_partner_guard" BEFORE INSERT ON "affiliate_payout_events"
FOR EACH ROW EXECUTE FUNCTION "assert_affiliate_payout_child"();
CREATE TRIGGER "affiliate_payout_journal_partner_guard" BEFORE INSERT ON "affiliate_payout_journal_entries"
FOR EACH ROW EXECUTE FUNCTION "assert_affiliate_payout_child"();
CREATE TRIGGER "affiliate_payout_operation_partner_guard" BEFORE INSERT ON "affiliate_payout_operations"
FOR EACH ROW EXECUTE FUNCTION "assert_affiliate_payout_child"();

CREATE FUNCTION "guard_affiliate_payout_update"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" <> 'pending' OR NEW."status" = 'pending' THEN
    RAISE EXCEPTION 'Affiliate payout status transition is invalid';
  END IF;
  IF NEW."id" <> OLD."id" OR NEW."partner_id" <> OLD."partner_id"
    OR NEW."amount_kopecks" <> OLD."amount_kopecks"
    OR NEW."minimum_payout_kopecks" <> OLD."minimum_payout_kopecks"
    OR NEW."contract_version" <> OLD."contract_version"
    OR NEW."contract_number" <> OLD."contract_number"
    OR NEW."contract_signed_at" <> OLD."contract_signed_at"
    OR NEW."contract_payment_details" <> OLD."contract_payment_details"
    OR NEW."created_at" <> OLD."created_at" OR NEW."updated_at" < OLD."updated_at" THEN
    RAISE EXCEPTION 'Affiliate payout snapshot is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "affiliate_payout_update_guard" BEFORE UPDATE ON "affiliate_payouts"
FOR EACH ROW EXECUTE FUNCTION "guard_affiliate_payout_update"();

CREATE FUNCTION "reject_affiliate_payout_append_only_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Affiliate payout audit rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "affiliate_payout_delete_guard" BEFORE DELETE ON "affiliate_payouts"
FOR EACH ROW EXECUTE FUNCTION "reject_affiliate_payout_append_only_mutation"();
CREATE TRIGGER "affiliate_payout_events_append_only" BEFORE UPDATE OR DELETE ON "affiliate_payout_events"
FOR EACH ROW EXECUTE FUNCTION "reject_affiliate_payout_append_only_mutation"();
CREATE TRIGGER "affiliate_payout_journal_append_only" BEFORE UPDATE OR DELETE ON "affiliate_payout_journal_entries"
FOR EACH ROW EXECUTE FUNCTION "reject_affiliate_payout_append_only_mutation"();
CREATE TRIGGER "affiliate_payout_operations_append_only" BEFORE UPDATE OR DELETE ON "affiliate_payout_operations"
FOR EACH ROW EXECUTE FUNCTION "reject_affiliate_payout_append_only_mutation"();
