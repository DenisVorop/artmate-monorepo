import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrations = [
  "20260920140000_loyalty_order_discount",
  "20260920141000_finalize_order_discount",
];

async function createDatabase() {
  const db = new PGlite();
  // This fixture isolates finalization/immutability. Full snapshot arithmetic is
  // covered by order-pricing-snapshot.migration.spec.ts, not by this validator spy.
  await db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      subtotal NUMERIC NOT NULL DEFAULT 100,
      discount NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 103,
      delivery_price NUMERIC NOT NULL DEFAULT 3,
      currency TEXT NOT NULL DEFAULT 'RUB',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      promo_code TEXT,
      promo_terms_snapshot JSONB,
      promo_pricing_snapshot JSONB,
      pricing_snapshot JSONB,
      CONSTRAINT orders_promo_snapshot_shape_check CHECK (
        (promo_code IS NULL AND discount = 0 AND promo_terms_snapshot IS NULL AND promo_pricing_snapshot IS NULL)
        OR (promo_code IS NOT NULL AND promo_terms_snapshot IS NOT NULL AND promo_pricing_snapshot IS NOT NULL)
      )
    );
    CREATE TABLE validation_calls (order_id TEXT NOT NULL);
    CREATE FUNCTION validate_order_pricing_snapshot(order_row orders) RETURNS void AS $$
    BEGIN
      IF order_row.pricing_snapshot ->> 'invalid' = 'true' THEN
        RAISE EXCEPTION 'fixture snapshot validation failed';
      END IF;
      INSERT INTO validation_calls VALUES (order_row.id);
    END;
    $$ LANGUAGE plpgsql;
    CREATE FUNCTION prevent_order_promo_snapshot_update() RETURNS trigger AS $$
    BEGIN
      IF OLD.promo_code IS NOT NULL AND (
        OLD.promo_code IS DISTINCT FROM NEW.promo_code
        OR OLD.discount IS DISTINCT FROM NEW.discount
        OR OLD.promo_terms_snapshot IS DISTINCT FROM NEW.promo_terms_snapshot
        OR OLD.promo_pricing_snapshot IS DISTINCT FROM NEW.promo_pricing_snapshot
      ) THEN RAISE EXCEPTION 'order promo snapshots are immutable'; END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER orders_immutable_promo_snapshots BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION prevent_order_promo_snapshot_update();
    CREATE FUNCTION guard_order_pricing_snapshot() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'UPDATE' THEN
        IF OLD.pricing_snapshot IS NOT NULL THEN
          IF OLD.pricing_snapshot IS DISTINCT FROM NEW.pricing_snapshot THEN
            RAISE EXCEPTION 'Order pricing snapshot is immutable';
          END IF;
          RETURN NEW;
        END IF;
      END IF;
      IF NEW.pricing_snapshot IS NOT NULL THEN PERFORM validate_order_pricing_snapshot(NEW); END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER orders_immutable_pricing_snapshot BEFORE INSERT OR UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION guard_order_pricing_snapshot();
  `);
  for (const migration of migrations) {
    await db.exec(
      await readFile(
        resolve(__dirname, `../prisma/migrations/${migration}/migration.sql`),
        "utf8",
      ),
    );
  }
  return db;
}

describe("order pricing finalization migration", () => {
  it("allows attaching promo audit before installing the final mixed-discount snapshot", async () => {
    const db = await createDatabase();
    try {
      await db.exec(`
        INSERT INTO orders (id) VALUES ('promo-order');
        UPDATE orders SET promo_code = 'SALE', promo_terms_snapshot = '{"type":"percentage"}',
          promo_pricing_snapshot = '{"discountKopecks":1000}' WHERE id = 'promo-order';
        UPDATE orders SET discount = 15, total = 88,
          pricing_snapshot = '{"promoDiscountKopecks":1000,"loyaltyDiscountKopecks":500}' WHERE id = 'promo-order';
      `);
      const row = await db.query<{ discount: string; total: string }>(
        "SELECT discount::text, total::text FROM orders WHERE id = 'promo-order'",
      );
      assert.equal(row.rows[0]?.discount, "15");
      assert.equal(row.rows[0]?.total, "88");
      const calls = await db.query<{ order_id: string }>(
        "SELECT order_id FROM validation_calls",
      );
      assert.deepEqual(calls.rows, [{ order_id: "promo-order" }]);
      for (const assignment of [
        "promo_code = 'OTHER'",
        "promo_terms_snapshot = '{}'",
        "promo_pricing_snapshot = '{}'",
        "promo_code = NULL",
      ]) {
        await assert.rejects(
          db.exec(`UPDATE orders SET ${assignment} WHERE id = 'promo-order'`),
          /order promo snapshots are immutable/,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("freezes finalized monetary fields and snapshots for both promo and loyalty-only orders", async () => {
    const db = await createDatabase();
    try {
      await db.exec(`
        INSERT INTO orders (id) VALUES ('loyalty-order'), ('promo-order');
        UPDATE orders SET discount = 5, total = 98,
          pricing_snapshot = '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":500}' WHERE id = 'loyalty-order';
        UPDATE orders SET promo_code = 'SALE', promo_terms_snapshot = '{}', promo_pricing_snapshot = '{}' WHERE id = 'promo-order';
        UPDATE orders SET discount = 10, total = 93,
          pricing_snapshot = '{"promoDiscountKopecks":1000,"loyaltyDiscountKopecks":0}' WHERE id = 'promo-order';
      `);
      for (const id of ["loyalty-order", "promo-order"]) {
        for (const assignment of [
          "discount = discount + 1",
          "subtotal = subtotal + 1",
          "total = total + 1",
          "delivery_price = delivery_price + 1",
          "currency = 'USD'",
        ]) {
          await assert.rejects(
            db.exec(`UPDATE orders SET ${assignment} WHERE id = '${id}'`),
            /Finalized order amounts are immutable/,
          );
        }
        for (const assignment of [
          "pricing_snapshot = '{}'",
          "pricing_snapshot = NULL",
        ]) {
          await assert.rejects(
            db.exec(`UPDATE orders SET ${assignment} WHERE id = '${id}'`),
            /Order pricing snapshot is immutable/,
          );
        }
        await db.exec(
          `UPDATE orders SET payment_status = 'paid', total = total, discount = discount WHERE id = '${id}'`,
        );
      }
      const rows = await db.query<{ payment_status: string }>(
        "SELECT payment_status FROM orders",
      );
      assert.ok(rows.rows.every((row) => row.payment_status === "paid"));
      const calls = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM validation_calls",
      );
      assert.equal(calls.rows[0]?.count, 2);
    } finally {
      await db.close();
    }
  });

  it("still invokes snapshot validation on first installation and direct insert", async () => {
    const db = await createDatabase();
    try {
      await db.exec("INSERT INTO orders (id) VALUES ('new-order')");
      await assert.rejects(
        db.exec(
          `UPDATE orders SET pricing_snapshot = '{"invalid":true}' WHERE id = 'new-order'`,
        ),
        /fixture snapshot validation failed/,
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO orders (id, pricing_snapshot) VALUES ('invalid-insert', '{"invalid":true}')`,
        ),
        /fixture snapshot validation failed/,
      );
      await db.exec(
        `INSERT INTO orders (id, pricing_snapshot) VALUES ('valid-insert', '{}')`,
      );
      const calls = await db.query<{ order_id: string }>(
        "SELECT order_id FROM validation_calls",
      );
      assert.deepEqual(calls.rows, [{ order_id: "valid-insert" }]);
      const row = await db.query<{ pricing_snapshot: unknown }>(
        "SELECT pricing_snapshot FROM orders WHERE id = 'new-order'",
      );
      assert.equal(row.rows[0]?.pricing_snapshot, null);
    } finally {
      await db.close();
    }
  });
});
