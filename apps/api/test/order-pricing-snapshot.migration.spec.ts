import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import { parseOrderPricingSnapshot } from "../src/orders/pricing/pricing-snapshot";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260920120000_order_pricing_snapshot/migration.sql",
);

const legacyPromo = {
  subtotalKopecks: 303,
  discountKopecks: 202,
  totalKopecks: 101,
  items: [
    {
      id: "product-b",
      unitPriceKopecks: 101,
      quantity: 3,
      subtotalKopecks: 303,
      discountKopecks: 202,
      totalKopecks: 101,
      // Deliberately keep an unusual order: an existing partial refund depends on it.
      priceGroups: [
        { quantity: 1, unitPriceKopecks: 33, totalKopecks: 33 },
        { quantity: 2, unitPriceKopecks: 34, totalKopecks: 68 },
      ],
    },
    {
      id: "product-a",
      unitPriceKopecks: 0,
      quantity: 1,
      subtotalKopecks: 0,
      discountKopecks: 0,
      totalKopecks: 0,
      priceGroups: [{ quantity: 1, unitPriceKopecks: 0, totalKopecks: 0 }],
    },
  ],
};

function expectedPromo() {
  return {
    version: 1,
    currency: "RUB",
    subtotalKopecks: 303,
    promoDiscountKopecks: 202,
    loyaltyDiscountKopecks: 0,
    discountKopecks: 202,
    itemsTotalKopecks: 101,
    deliveryKopecks: 15,
    totalKopecks: 116,
    items: legacyPromo.items.map((item) => ({
      id: item.id,
      unitPriceKopecks: item.unitPriceKopecks,
      quantity: item.quantity,
      subtotalKopecks: item.subtotalKopecks,
      promoDiscountKopecks: item.discountKopecks,
      loyaltyPoints: 0,
      loyaltyDiscountKopecks: 0,
      totalKopecks: item.totalKopecks,
      priceGroups: item.priceGroups.map((group) => ({
        ...group,
        promoDiscountPerUnitKopecks:
          item.unitPriceKopecks - group.unitPriceKopecks,
        loyaltyPointsPerUnit: 0,
      })),
    })),
  };
}

const plainSnapshot = {
  version: 1,
  currency: "RUB",
  subtotalKopecks: 3,
  promoDiscountKopecks: 0,
  loyaltyDiscountKopecks: 0,
  discountKopecks: 0,
  itemsTotalKopecks: 3,
  deliveryKopecks: 7,
  totalKopecks: 10,
  items: [
    {
      id: "product-b",
      unitPriceKopecks: 1,
      quantity: 3,
      subtotalKopecks: 3,
      promoDiscountKopecks: 0,
      loyaltyPoints: 0,
      loyaltyDiscountKopecks: 0,
      totalKopecks: 3,
      priceGroups: [
        {
          quantity: 3,
          unitPriceKopecks: 1,
          promoDiscountPerUnitKopecks: 0,
          loyaltyPointsPerUnit: 0,
          totalKopecks: 3,
        },
      ],
    },
    {
      id: "product-a",
      unitPriceKopecks: 0,
      quantity: 1,
      subtotalKopecks: 0,
      promoDiscountKopecks: 0,
      loyaltyPoints: 0,
      loyaltyDiscountKopecks: 0,
      totalKopecks: 0,
      priceGroups: [
        {
          quantity: 1,
          unitPriceKopecks: 0,
          promoDiscountPerUnitKopecks: 0,
          loyaltyPointsPerUnit: 0,
          totalKopecks: 0,
        },
      ],
    },
  ],
};

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'RUB',
      status TEXT NOT NULL DEFAULT 'pending_payment',
      subtotal NUMERIC NOT NULL,
      discount NUMERIC NOT NULL DEFAULT 0,
      delivery_price NUMERIC NOT NULL,
      total NUMERIC NOT NULL,
      promo_code TEXT,
      promo_pricing_snapshot JSONB
    );
    CREATE TABLE order_items (
      order_id TEXT NOT NULL REFERENCES orders(id),
      product_id TEXT NOT NULL,
      price NUMERIC NOT NULL,
      quantity INTEGER NOT NULL,
      line_total NUMERIC NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT '2026-09-01',
      PRIMARY KEY (order_id, product_id)
    );
  `);
  return db;
}

async function seedPlain(db: PGlite, id: string) {
  await db.query(
    `INSERT INTO orders (id, subtotal, delivery_price, total) VALUES ($1, 0.03, 0.07, 0.10)`,
    [id],
  );
  await db.query(
    `INSERT INTO order_items (order_id, product_id, price, quantity, line_total, created_at)
      VALUES ($1, 'product-a', 0, 1, 0, '2026-09-02'), ($1, 'product-b', 0.01, 3, 0.03, '2026-09-01')`,
    [id],
  );
}

async function seedPromo(
  db: PGlite,
  id: string,
  source: unknown = legacyPromo,
) {
  await db.query(
    `INSERT INTO orders (id, subtotal, discount, delivery_price, total, promo_code, promo_pricing_snapshot)
      VALUES ($1, 3.03, 2.02, 0.15, 1.16, 'PROMO', $2::jsonb)`,
    [id, JSON.stringify(source)],
  );
  await db.query(
    `INSERT INTO order_items (order_id, product_id, price, quantity, line_total)
      VALUES ($1, 'product-a', 0, 1, 0), ($1, 'product-b', 1.01, 3, 3.03)`,
    [id],
  );
}

async function oldData(db: PGlite) {
  return (
    await db.query(`
      SELECT id, currency, status, subtotal::text, discount::text, delivery_price::text,
        total::text, promo_code, promo_pricing_snapshot,
        (SELECT jsonb_agg(to_jsonb(i) ORDER BY product_id) FROM order_items i WHERE i.order_id = o.id) AS items
      FROM orders o ORDER BY id
    `)
  ).rows;
}

async function assertRollback(db: PGlite, migration: string, label: string) {
  const before = await oldData(db);
  await assert.rejects(
    db.exec(migration),
    /Invalid order pricing snapshot/,
    label,
  );
  await db.exec("ROLLBACK");
  assert.deepEqual(await oldData(db), before, label);
  assert.equal(
    (
      await db.query(`SELECT column_name FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'pricing_snapshot'`)
    ).rows.length,
    0,
    `${label}: failed backfill must roll back its column and earlier successful rows`,
  );
  assert.equal(
    (
      await db.query(
        `SELECT proname FROM pg_proc WHERE proname = 'order_pricing_uint'`,
      )
    ).rows.length,
    0,
    `${label}: functions must roll back too`,
  );
}

describe("order pricing snapshot migration", () => {
  it("backfills pending/paid orders exactly, retaining cents, zero prices and promo group order", async () => {
    const db = await createDatabase();
    try {
      await seedPlain(db, "plain");
      await seedPromo(db, "promo");
      await db.exec(`UPDATE orders SET status = 'paid' WHERE id = 'promo'`);
      const before = await oldData(db);
      await db.exec(await readFile(migrationPath, "utf8"));
      assert.deepEqual(await oldData(db), before);
      const result = await db.query<{ id: string; pricing_snapshot: unknown }>(
        `SELECT id, pricing_snapshot FROM orders ORDER BY id`,
      );
      assert.deepEqual(result.rows, [
        { id: "plain", pricing_snapshot: plainSnapshot },
        { id: "promo", pricing_snapshot: expectedPromo() },
      ]);
      for (const row of result.rows) {
        assert.deepEqual(
          parseOrderPricingSnapshot(row.pricing_snapshot),
          row.pricing_snapshot,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("allows transaction-local null pricing, a promo total update and one valid finalization", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await db.exec("BEGIN");
      await seedPromo(db, "new");
      await db.exec(`UPDATE orders SET total = 3.18 WHERE id = 'new'`);
      await db.exec(`UPDATE orders SET total = 1.16 WHERE id = 'new'`);
      await db.query(
        `UPDATE orders SET pricing_snapshot = $1::jsonb WHERE id = 'new'`,
        [JSON.stringify(expectedPromo())],
      );
      await db.exec("COMMIT");
      await db.exec(
        `UPDATE orders SET status = 'paid', pricing_snapshot = pricing_snapshot WHERE id = 'new'`,
      );
      for (const replacement of [
        null,
        {},
        { ...plainSnapshot, unexpected: true },
        { ...expectedPromo(), totalKopecks: 117 },
      ]) {
        await assert.rejects(
          db.query(
            `UPDATE orders SET pricing_snapshot = $1::jsonb WHERE id = 'new'`,
            [replacement === null ? null : JSON.stringify(replacement)],
          ),
          /immutable/,
        );
      }
      assert.deepEqual(
        (await db.query(`SELECT pricing_snapshot FROM orders WHERE id = 'new'`))
          .rows,
        [{ pricing_snapshot: expectedPromo() }],
      );
    } finally {
      await db.close();
    }
  });

  it("rejects malformed initial snapshots and leaves null available for a valid finalization", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      await seedPlain(db, "new");
      for (const snapshot of [
        {},
        { ...plainSnapshot, version: 2 },
        { ...plainSnapshot, currency: "USD" },
        { ...plainSnapshot, totalKopecks: "10" },
        { ...plainSnapshot, totalKopecks: 10.5 },
        { ...plainSnapshot, totalKopecks: Number.MAX_SAFE_INTEGER + 1 },
        { ...plainSnapshot, items: [] },
        {
          ...plainSnapshot,
          items: [plainSnapshot.items[0], plainSnapshot.items[0]],
        },
        { ...plainSnapshot, loyaltyDiscountKopecks: 1 },
      ]) {
        await assert.rejects(
          db.query(
            `UPDATE orders SET pricing_snapshot = $1::jsonb WHERE id = 'new'`,
            [JSON.stringify(snapshot)],
          ),
          /Invalid order pricing snapshot/,
        );
      }
      await assert.rejects(
        db.query(
          `INSERT INTO orders (id, subtotal, delivery_price, total, pricing_snapshot)
          VALUES ('invalid-insert', 0.03, 0.07, 0.10, $1::jsonb)`,
          [JSON.stringify(plainSnapshot)],
        ),
        /unknown item/,
      );
      await db.query(
        `UPDATE orders SET pricing_snapshot = $1::jsonb WHERE id = 'new'`,
        [JSON.stringify(plainSnapshot)],
      );
    } finally {
      await db.close();
    }
  });

  it("accepts loyalty and mixed allocations at 20 kopecks per point and rejects inconsistent allocations", async () => {
    const db = await createDatabase();
    try {
      await db.exec(await readFile(migrationPath, "utf8"));
      for (const promoPerUnit of [0, 10]) {
        const id = `loyalty-${promoPerUnit}`;
        await seedPlain(db, id);
        const snapshot = structuredClone(plainSnapshot);
        const item = snapshot.items[0]!;
        item.unitPriceKopecks = 101;
        item.subtotalKopecks = 303;
        item.promoDiscountKopecks = 3 * promoPerUnit;
        item.loyaltyPoints = 5;
        item.loyaltyDiscountKopecks = 100;
        item.totalKopecks = 203 - 3 * promoPerUnit;
        item.priceGroups = [
          {
            quantity: 1,
            unitPriceKopecks: 81 - promoPerUnit,
            promoDiscountPerUnitKopecks: promoPerUnit,
            loyaltyPointsPerUnit: 1,
            totalKopecks: 81 - promoPerUnit,
          },
          {
            quantity: 2,
            unitPriceKopecks: 61 - promoPerUnit,
            promoDiscountPerUnitKopecks: promoPerUnit,
            loyaltyPointsPerUnit: 2,
            totalKopecks: 122 - 2 * promoPerUnit,
          },
        ];
        snapshot.subtotalKopecks = 303;
        snapshot.promoDiscountKopecks = item.promoDiscountKopecks;
        snapshot.loyaltyDiscountKopecks = 100;
        snapshot.discountKopecks = 100 + item.promoDiscountKopecks;
        snapshot.itemsTotalKopecks = item.totalKopecks;
        snapshot.totalKopecks = item.totalKopecks + 7;
        await db.query(
          `UPDATE orders SET subtotal = 3.03, discount = $2::numeric / 100,
            total = $3::numeric / 100 WHERE id = $1`,
          [id, snapshot.discountKopecks, snapshot.totalKopecks],
        );
        await db.query(
          `UPDATE order_items SET price = 1.01, line_total = 3.03
            WHERE order_id = $1 AND product_id = 'product-b'`,
          [id],
        );

        const mutations: Array<(value: typeof snapshot) => void> = [
          (s) => {
            s.items[0]!.priceGroups[0]!.loyaltyPointsPerUnit = 2;
          },
          (s) => {
            s.items[0]!.priceGroups[0]!.loyaltyPointsPerUnit = 0.5;
          },
          (s) => {
            s.items[0]!.priceGroups[0]!.promoDiscountPerUnitKopecks += 1;
          },
          (s) => {
            s.items[0]!.loyaltyPoints = 4;
          },
          (s) => {
            s.items[0]!.loyaltyDiscountKopecks = 80;
          },
          // Keep the root combined discount intact but misattribute its sources.
          (s) => {
            s.loyaltyDiscountKopecks = 80;
            s.promoDiscountKopecks += 20;
          },
          // Keep item totals and conversion intact but disagree with group allocation.
          (s) => {
            s.items[0]!.loyaltyPoints = 4;
            s.items[0]!.loyaltyDiscountKopecks = 80;
            s.items[0]!.promoDiscountKopecks += 20;
            s.loyaltyDiscountKopecks = 80;
            s.promoDiscountKopecks += 20;
          },
        ];
        for (const mutate of mutations) {
          const invalid = structuredClone(snapshot);
          mutate(invalid);
          assert.throws(() => parseOrderPricingSnapshot(invalid));
          await assert.rejects(
            db.query(
              `UPDATE orders SET pricing_snapshot = $2::jsonb WHERE id = $1`,
              [id, JSON.stringify(invalid)],
            ),
            /Invalid order pricing snapshot/,
          );
        }
        assert.deepEqual(parseOrderPricingSnapshot(snapshot), snapshot);
        await db.query(
          `UPDATE orders SET pricing_snapshot = $2::jsonb WHERE id = $1`,
          [id, JSON.stringify(snapshot)],
        );
        assert.deepEqual(
          (
            await db.query(
              `SELECT pricing_snapshot FROM orders WHERE id = $1`,
              [id],
            )
          ).rows,
          [{ pricing_snapshot: snapshot }],
        );
        await assert.rejects(
          db.query(`UPDATE orders SET pricing_snapshot = NULL WHERE id = $1`, [
            id,
          ]),
          /immutable/,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("fails atomically for malformed or ambiguous historical promo snapshots", async () => {
    const db = await createDatabase();
    try {
      await seedPlain(db, "a-valid");
      const migration = await readFile(migrationPath, "utf8");
      const variants: Array<[string, (source: typeof legacyPromo) => unknown]> =
        [
          ["null", () => null],
          ["missing snapshot fields", () => ({ items: [] })],
          [
            "root total includes delivery",
            (s) => ({ ...s, totalKopecks: 116 }),
          ],
          ["string money", (s) => ({ ...s, subtotalKopecks: "303" })],
          ["negative discount", (s) => ({ ...s, discountKopecks: -1 })],
          ["fractional money", (s) => ({ ...s, totalKopecks: 101.5 })],
          [
            "unsafe integer",
            (s) => ({ ...s, subtotalKopecks: 9007199254740992 }),
          ],
          [
            "duplicate products",
            (s) => ({ ...s, items: [s.items[0], s.items[0]] }),
          ],
          ["missing product", (s) => ({ ...s, items: [s.items[0]] })],
          [
            "extra product",
            (s) => ({
              ...s,
              items: [...s.items, { ...s.items[1], id: "extra" }],
            }),
          ],
          [
            "missing groups",
            (s) => {
              delete (s.items[0] as Partial<(typeof s.items)[0]>).priceGroups;
              return s;
            },
          ],
          [
            "wrong original price",
            (s) => {
              s.items[0]!.unitPriceKopecks = 102;
              return s;
            },
          ],
          [
            "wrong item subtotal",
            (s) => {
              s.items[0]!.subtotalKopecks = 304;
              return s;
            },
          ],
          [
            "wrong item discount",
            (s) => {
              s.items[0]!.discountKopecks = 201;
              return s;
            },
          ],
          [
            "wrong item total",
            (s) => {
              s.items[0]!.totalKopecks = 100;
              return s;
            },
          ],
          [
            "zero quantity",
            (s) => {
              s.items[0]!.quantity = 0;
              return s;
            },
          ],
          [
            "fractional group quantity",
            (s) => {
              s.items[0]!.priceGroups[0]!.quantity = 0.5;
              return s;
            },
          ],
          [
            "negative group price",
            (s) => {
              s.items[0]!.priceGroups[0]!.unitPriceKopecks = -1;
              return s;
            },
          ],
          [
            "group price above original",
            (s) => {
              s.items[0]!.priceGroups[0]!.unitPriceKopecks = 102;
              return s;
            },
          ],
          [
            "inconsistent group product",
            (s) => {
              s.items[0]!.priceGroups[0]!.totalKopecks = 32;
              return s;
            },
          ],
          [
            "missing group",
            (s) => {
              s.items[0]!.priceGroups.pop();
              return s;
            },
          ],
        ];
      for (const [label, change] of variants) {
        await seedPromo(db, "z-invalid", change(structuredClone(legacyPromo)));
        await assertRollback(db, migration, label);
        await db.exec(
          `DELETE FROM order_items WHERE order_id = 'z-invalid'; DELETE FROM orders WHERE id = 'z-invalid'`,
        );
      }
    } finally {
      await db.close();
    }
  });

  it("fails atomically for inconsistent plain historical orders without repairing amounts", async () => {
    const db = await createDatabase();
    try {
      await seedPlain(db, "a-valid");
      const migration = await readFile(migrationPath, "utf8");
      for (const [label, statement] of [
        [
          "wrong currency",
          `UPDATE orders SET currency = 'USD' WHERE id = 'z-invalid'`,
        ],
        [
          "wrong total",
          `UPDATE orders SET total = 0.11 WHERE id = 'z-invalid'`,
        ],
        [
          "wrong subtotal",
          `UPDATE orders SET subtotal = 0.04, total = 0.11 WHERE id = 'z-invalid'`,
        ],
        [
          "ambiguous discount",
          `UPDATE orders SET discount = 0.01 WHERE id = 'z-invalid'`,
        ],
        [
          "orphan promo snapshot",
          `UPDATE orders SET promo_pricing_snapshot = '{}' WHERE id = 'z-invalid'`,
        ],
        [
          "fractional kopeck",
          `UPDATE orders SET delivery_price = 0.071, total = 0.101 WHERE id = 'z-invalid'`,
        ],
        [
          "negative delivery",
          `UPDATE orders SET delivery_price = -0.01, total = 0.02 WHERE id = 'z-invalid'`,
        ],
        ["no items", `DELETE FROM order_items WHERE order_id = 'z-invalid'`],
        [
          "bad line total",
          `UPDATE order_items SET line_total = 0.04 WHERE order_id = 'z-invalid' AND product_id = 'product-b'`,
        ],
        [
          "zero quantity",
          `UPDATE order_items SET quantity = 0 WHERE order_id = 'z-invalid' AND product_id = 'product-b'`,
        ],
        [
          "negative price",
          `UPDATE order_items SET price = -0.01 WHERE order_id = 'z-invalid' AND product_id = 'product-b'`,
        ],
      ]) {
        await seedPlain(db, "z-invalid");
        await db.exec(statement!);
        await assertRollback(db, migration, label!);
        await db.exec(
          `DELETE FROM order_items WHERE order_id = 'z-invalid'; DELETE FROM orders WHERE id = 'z-invalid'`,
        );
      }
    } finally {
      await db.close();
    }
  });
});
