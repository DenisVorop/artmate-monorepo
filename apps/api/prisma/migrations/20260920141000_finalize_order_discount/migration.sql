BEGIN;

-- Promo metadata is immutable once attached. The final discount also includes
-- loyalty and is owned by the canonical order pricing snapshot, not this audit.
CREATE OR REPLACE FUNCTION prevent_order_promo_snapshot_update() RETURNS trigger AS $$
BEGIN
  IF OLD."promo_code" IS NOT NULL AND (
    OLD."promo_code" IS DISTINCT FROM NEW."promo_code"
    OR OLD."promo_terms_snapshot" IS DISTINCT FROM NEW."promo_terms_snapshot"
    OR OLD."promo_pricing_snapshot" IS DISTINCT FROM NEW."promo_pricing_snapshot"
  ) THEN
    RAISE EXCEPTION 'order promo snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Checkout may finalize scalar amounts when installing its first snapshot.
-- Afterwards the snapshot and every amount it describes must stay together.
CREATE OR REPLACE FUNCTION guard_order_pricing_snapshot() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.pricing_snapshot IS NOT NULL THEN
      IF OLD.pricing_snapshot IS DISTINCT FROM NEW.pricing_snapshot THEN
        RAISE EXCEPTION 'Order pricing snapshot is immutable';
      END IF;
      IF OLD.discount IS DISTINCT FROM NEW.discount
        OR OLD.subtotal IS DISTINCT FROM NEW.subtotal
        OR OLD.total IS DISTINCT FROM NEW.total
        OR OLD.delivery_price IS DISTINCT FROM NEW.delivery_price
        OR OLD.currency IS DISTINCT FROM NEW.currency THEN
        RAISE EXCEPTION 'Finalized order amounts are immutable';
      END IF;
      RETURN NEW;
    END IF;
  END IF;
  IF NEW.pricing_snapshot IS NOT NULL THEN
    PERFORM validate_order_pricing_snapshot(NEW);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
