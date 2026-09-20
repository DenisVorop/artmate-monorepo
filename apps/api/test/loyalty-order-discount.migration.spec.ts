import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260920140000_loyalty_order_discount/migration.sql",
);

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 100,
      discount DECIMAL(12,2) NOT NULL DEFAULT 0,
      promo_code TEXT,
      promo_terms_snapshot JSONB,
      promo_pricing_snapshot JSONB,
      pricing_snapshot JSONB,
      CONSTRAINT orders_discount_check CHECK (discount >= 0 AND discount <= subtotal),
      CONSTRAINT orders_promo_snapshot_shape_check CHECK (
        (promo_code IS NULL AND discount = 0 AND promo_terms_snapshot IS NULL AND promo_pricing_snapshot IS NULL)
        OR (promo_code IS NOT NULL AND promo_terms_snapshot IS NOT NULL AND promo_pricing_snapshot IS NOT NULL)
      )
    );
    INSERT INTO orders (id) VALUES ('existing-ordinary');
    INSERT INTO orders (id, discount, promo_code, promo_terms_snapshot, promo_pricing_snapshot)
      VALUES ('existing-promo', 10, 'SALE', '{}', '{}');
  `);
  return db;
}

type OrderInput = {
  id: string;
  discount?: number;
  promo?: string | null;
  terms?: string | null;
  promoSnapshot?: string | null;
  snapshot?: string | null;
};

function insert(db: PGlite, input: OrderInput) {
  return db.query(
    `INSERT INTO orders (id, discount, promo_code, promo_terms_snapshot, promo_pricing_snapshot, pricing_snapshot)
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)`,
    [
      input.id,
      input.discount ?? 0,
      input.promo ?? null,
      input.terms ?? null,
      input.promoSnapshot ?? null,
      input.snapshot ?? null,
    ],
  );
}

describe("loyalty order discount migration", () => {
  it("replaces the old guard without invalidating existing ordinary and promo orders", async () => {
    const db = await createDatabase();
    try {
      const loyalty = {
        id: "loyalty",
        discount: 5,
        snapshot: '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":500}',
      };
      await assert.rejects(
        insert(db, loyalty),
        /orders_promo_snapshot_shape_check/,
      );
      await db.exec(await readFile(migrationPath, "utf8"));
      await insert(db, loyalty);
      await insert(db, { id: "ordinary" });
      await insert(db, {
        id: "promo",
        discount: 10,
        promo: "SALE",
        terms: "{}",
        promoSnapshot: "{}",
        snapshot: '{"promoDiscountKopecks":1000,"loyaltyDiscountKopecks":0}',
      });
      await insert(db, {
        id: "promo-plus-loyalty",
        discount: 15,
        promo: "SALE",
        terms: "{}",
        promoSnapshot: "{}",
        snapshot: '{"promoDiscountKopecks":1000,"loyaltyDiscountKopecks":500}',
      });
      await insert(db, {
        id: "fractional-rubles",
        discount: 0.2,
        snapshot: '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":20}',
      });
      const result = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM orders",
      );
      assert.equal(result.rows[0]?.count, 7);
    } finally {
      await db.close();
    }
  });

  it("rejects missing, JSON-null, string-typed, wrong-promo and wrong-amount loyalty evidence", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      const snapshots = [
        null,
        "null",
        "{}",
        "[]",
        "0",
        '{"promoDiscountKopecks":0}',
        '{"loyaltyDiscountKopecks":500}',
        '{"promoDiscountKopecks":null,"loyaltyDiscountKopecks":500}',
        '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":null}',
        '{"promoDiscountKopecks":"0","loyaltyDiscountKopecks":500}',
        '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":"500"}',
        '{"promoDiscountKopecks":1,"loyaltyDiscountKopecks":500}',
        '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":499}',
        '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":501}',
      ];
      for (const [index, snapshot] of snapshots.entries()) {
        await assert.rejects(
          insert(db, { id: `invalid-${index}`, discount: 5, snapshot }),
          /orders_promo_snapshot_shape_check/,
          `snapshot ${snapshot}`,
        );
      }
      const result = await db.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM orders",
      );
      assert.equal(result.rows[0]?.count, 2);
    } finally {
      await db.close();
    }
  });

  it("preserves promo audit coupling and the independent discount range guard", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      const snapshot =
        '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":500}';
      const invalid: OrderInput[] = [
        { id: "orphan-terms", terms: "{}" },
        { id: "orphan-promo-snapshot", promoSnapshot: "{}" },
        {
          id: "loyalty-with-orphan-promo",
          discount: 5,
          terms: "{}",
          promoSnapshot: "{}",
          snapshot,
        },
        { id: "promo-no-snapshots", promo: "SALE", discount: 5, snapshot },
        {
          id: "promo-no-pricing",
          promo: "SALE",
          terms: "{}",
          discount: 5,
          snapshot,
        },
        {
          id: "promo-no-terms",
          promo: "SALE",
          promoSnapshot: "{}",
          discount: 5,
          snapshot,
        },
      ];
      for (const input of invalid)
        await assert.rejects(
          insert(db, input),
          /orders_promo_snapshot_shape_check/,
          input.id,
        );
      await assert.rejects(
        insert(db, {
          id: "over-subtotal",
          discount: 101,
          snapshot: '{"promoDiscountKopecks":0,"loyaltyDiscountKopecks":10100}',
        }),
        /orders_discount_check/,
      );
      await assert.rejects(
        insert(db, { id: "negative", discount: -1 }),
        /orders_discount_check/,
      );
    } finally {
      await db.close();
    }
  });
});
