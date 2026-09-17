ALTER TABLE "orders" ADD COLUMN "completed_at" TIMESTAMP(3);

CREATE TYPE "affiliate_ledger_entry_kind" AS ENUM ('credit', 'reversal');

CREATE TABLE "affiliate_commissions" (
  "id" VARCHAR(32) NOT NULL,
  "order_id" VARCHAR(32) NOT NULL,
  "partner_id" VARCHAR(32) NOT NULL,
  "code_snapshot" VARCHAR(40) NOT NULL,
  "partner_percent" INTEGER NOT NULL,
  "buyer_percent" INTEGER NOT NULL,
  "is_self_purchase" BOOLEAN NOT NULL,
  "subtotal_kopecks" BIGINT NOT NULL,
  "earned_kopecks" BIGINT NOT NULL,
  "item_snapshot" JSONB NOT NULL,
  "available_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_commissions_rates_check" CHECK (
    "partner_percent" BETWEEN 0 AND 15
    AND "buyer_percent" = 20 - "partner_percent"
  ),
  CONSTRAINT "affiliate_commissions_amounts_check" CHECK (
    "subtotal_kopecks" >= 0 AND "earned_kopecks" >= 0
    AND "earned_kopecks" <= "subtotal_kopecks"
  )
);

CREATE TABLE "order_refunds" (
  "id" VARCHAR(32) NOT NULL,
  "order_id" VARCHAR(32) NOT NULL,
  "author_id" TEXT NOT NULL,
  "request_id" UUID NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "reference" VARCHAR(120) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "delivery_kopecks" BIGINT NOT NULL,
  "total_kopecks" BIGINT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "order_refunds_amounts_check" CHECK (
    "delivery_kopecks" >= 0 AND "total_kopecks" >= 0
    AND "delivery_kopecks" <= "total_kopecks"
  ),
  CONSTRAINT "order_refunds_fingerprint_check" CHECK (
    "request_fingerprint" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT "order_refunds_reference_check" CHECK (length(btrim("reference")) > 0),
  CONSTRAINT "order_refunds_reason_check" CHECK (length(btrim("reason")) > 0)
);

CREATE TABLE "order_refund_items" (
  "refund_id" VARCHAR(32) NOT NULL,
  "product_id" VARCHAR(191) NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "amount_kopecks" BIGINT NOT NULL,
  CONSTRAINT "order_refund_items_pkey" PRIMARY KEY ("refund_id", "product_id"),
  CONSTRAINT "order_refund_items_values_check" CHECK (
    "quantity" > 0 AND "amount_kopecks" >= 0
  )
);

CREATE TABLE "affiliate_ledger_entries" (
  "id" VARCHAR(32) NOT NULL,
  "commission_id" VARCHAR(32) NOT NULL,
  "order_id" VARCHAR(32) NOT NULL,
  "partner_id" VARCHAR(32) NOT NULL,
  "refund_id" VARCHAR(32),
  "kind" "affiliate_ledger_entry_kind" NOT NULL,
  "amount_kopecks" BIGINT NOT NULL,
  "operation_key" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "affiliate_ledger_entries_amount_check" CHECK (
    ("kind" = 'credit' AND "amount_kopecks" >= 0)
    OR ("kind" = 'reversal' AND "amount_kopecks" < 0)
  ),
  CONSTRAINT "affiliate_ledger_entries_refund_kind_check" CHECK (
    ("kind" = 'credit' AND "refund_id" IS NULL)
    OR ("kind" = 'reversal' AND "refund_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "affiliate_commissions_order_id_key" ON "affiliate_commissions"("order_id");
CREATE INDEX "affiliate_commissions_partner_id_created_at_idx" ON "affiliate_commissions"("partner_id", "created_at");
CREATE UNIQUE INDEX "order_refunds_order_id_request_id_key" ON "order_refunds"("order_id", "request_id");
CREATE UNIQUE INDEX "order_refunds_order_id_reference_key" ON "order_refunds"("order_id", "reference");
CREATE INDEX "order_refunds_order_id_created_at_idx" ON "order_refunds"("order_id", "created_at");
CREATE INDEX "order_refunds_author_id_idx" ON "order_refunds"("author_id");
CREATE UNIQUE INDEX "affiliate_ledger_entries_refund_id_key" ON "affiliate_ledger_entries"("refund_id");
CREATE UNIQUE INDEX "affiliate_ledger_entries_operation_key_key" ON "affiliate_ledger_entries"("operation_key");
CREATE UNIQUE INDEX "affiliate_ledger_entries_commission_credit_key"
  ON "affiliate_ledger_entries"("commission_id") WHERE "kind" = 'credit';
CREATE INDEX "affiliate_ledger_entries_partner_id_created_at_idx" ON "affiliate_ledger_entries"("partner_id", "created_at");
CREATE INDEX "affiliate_ledger_entries_order_id_created_at_idx" ON "affiliate_ledger_entries"("order_id", "created_at");

ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "order_refund_items" ADD CONSTRAINT "order_refund_items_refund_id_fkey"
  FOREIGN KEY ("refund_id") REFERENCES "order_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_commission_id_fkey"
  FOREIGN KEY ("commission_id") REFERENCES "affiliate_commissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_partner_id_fkey"
  FOREIGN KEY ("partner_id") REFERENCES "affiliate_partners"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_refund_id_fkey"
  FOREIGN KEY ("refund_id") REFERENCES "order_refunds"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "reject_financial_audit_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'financial audit rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "guard_affiliate_commission_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'affiliate commissions are immutable';
  END IF;
  IF OLD."order_id" IS DISTINCT FROM NEW."order_id"
    OR OLD."partner_id" IS DISTINCT FROM NEW."partner_id"
    OR OLD."code_snapshot" IS DISTINCT FROM NEW."code_snapshot"
    OR OLD."partner_percent" IS DISTINCT FROM NEW."partner_percent"
    OR OLD."buyer_percent" IS DISTINCT FROM NEW."buyer_percent"
    OR OLD."is_self_purchase" IS DISTINCT FROM NEW."is_self_purchase"
    OR OLD."subtotal_kopecks" IS DISTINCT FROM NEW."subtotal_kopecks"
    OR OLD."earned_kopecks" IS DISTINCT FROM NEW."earned_kopecks"
    OR OLD."item_snapshot" IS DISTINCT FROM NEW."item_snapshot"
    OR OLD."created_at" IS DISTINCT FROM NEW."created_at"
    OR (OLD."available_at" IS NOT NULL AND OLD."available_at" IS DISTINCT FROM NEW."available_at")
  THEN
    RAISE EXCEPTION 'affiliate commissions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "validate_affiliate_ledger_references"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "affiliate_commissions"
    WHERE "id" = NEW."commission_id"
      AND "order_id" = NEW."order_id"
      AND "partner_id" = NEW."partner_id"
  ) THEN
    RAISE EXCEPTION 'ledger entry does not match its commission';
  END IF;
  IF NEW."refund_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "order_refunds"
    WHERE "id" = NEW."refund_id" AND "order_id" = NEW."order_id"
  ) THEN
    RAISE EXCEPTION 'ledger reversal does not match its refund order';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "order_refunds_immutable"
  BEFORE UPDATE OR DELETE ON "order_refunds"
  FOR EACH ROW EXECUTE FUNCTION "reject_financial_audit_mutation"();
CREATE TRIGGER "order_refund_items_immutable"
  BEFORE UPDATE OR DELETE ON "order_refund_items"
  FOR EACH ROW EXECUTE FUNCTION "reject_financial_audit_mutation"();
CREATE TRIGGER "affiliate_ledger_entries_immutable"
  BEFORE UPDATE OR DELETE ON "affiliate_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "reject_financial_audit_mutation"();
CREATE TRIGGER "affiliate_ledger_entries_reference_guard"
  BEFORE INSERT ON "affiliate_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "validate_affiliate_ledger_references"();
CREATE TRIGGER "affiliate_commissions_immutable"
  BEFORE UPDATE OR DELETE ON "affiliate_commissions"
  FOR EACH ROW EXECUTE FUNCTION "guard_affiliate_commission_mutation"();
