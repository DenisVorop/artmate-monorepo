import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationName = "20260920160000_refund_settlement_events";

async function applyMigration(db: PGlite, name = migrationName) {
  await db.exec(
    await readFile(
      resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
      "utf8",
    ),
  );
}

// These are the real previous migrations, including the complete pricing
// validator and audit triggers; no validation or immutability stubs are used.
async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE affiliate_partners (id VARCHAR(32) PRIMARY KEY, user_id TEXT NOT NULL);
    CREATE TABLE orders (
      id VARCHAR(32) PRIMARY KEY,
      currency TEXT NOT NULL DEFAULT 'RUB',
      status TEXT NOT NULL DEFAULT 'paid',
      payment_status TEXT NOT NULL DEFAULT 'paid',
      paid_at TIMESTAMP(3) DEFAULT '2026-09-19',
      checkout_actor_user_id TEXT,
      subtotal NUMERIC NOT NULL,
      discount NUMERIC NOT NULL DEFAULT 0,
      delivery_price NUMERIC NOT NULL,
      total NUMERIC NOT NULL,
      promo_code TEXT,
      promo_pricing_snapshot JSONB
    );
    CREATE TABLE order_items (
      order_id VARCHAR(32) NOT NULL REFERENCES orders(id),
      product_id VARCHAR(191) NOT NULL,
      price NUMERIC NOT NULL,
      quantity INTEGER NOT NULL,
      line_total NUMERIC NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT '2026-09-01',
      PRIMARY KEY (order_id, product_id)
    );
    INSERT INTO users VALUES ('admin', 'Admin');
  `);
  await applyMigration(db, "20260916210000_affiliate_financial_accounting");
  await applyMigration(db, "20260920120000_order_pricing_snapshot");
  return db;
}

type Group = { quantity: number; cash: number; points: number };

async function seedOrder(
  db: PGlite,
  groups: Group[] = [{ quantity: 4, cash: 160, points: 0 }],
  id = "order-1",
) {
  const unitPriceKopecks = 200;
  const quantity = groups.reduce((sum, group) => sum + group.quantity, 0);
  const cash = groups.reduce(
    (sum, group) => sum + group.quantity * group.cash,
    0,
  );
  const points = groups.reduce(
    (sum, group) => sum + group.quantity * group.points,
    0,
  );
  const subtotal = unitPriceKopecks * quantity;
  const promo = subtotal - cash - points * 20;
  const snapshot = {
    version: 1,
    currency: "RUB",
    subtotalKopecks: subtotal,
    promoDiscountKopecks: promo,
    loyaltyDiscountKopecks: points * 20,
    discountKopecks: subtotal - cash,
    itemsTotalKopecks: cash,
    deliveryKopecks: 100,
    totalKopecks: cash + 100,
    items: [
      {
        id: "product-1",
        unitPriceKopecks,
        quantity,
        subtotalKopecks: subtotal,
        promoDiscountKopecks: promo,
        loyaltyPoints: points,
        loyaltyDiscountKopecks: points * 20,
        totalKopecks: cash,
        priceGroups: groups.map((group) => ({
          quantity: group.quantity,
          unitPriceKopecks: group.cash,
          promoDiscountPerUnitKopecks:
            unitPriceKopecks - group.cash - group.points * 20,
          loyaltyPointsPerUnit: group.points,
          totalKopecks: group.quantity * group.cash,
        })),
      },
    ],
  };
  await db.query(
    "INSERT INTO orders (id, subtotal, discount, delivery_price, total) VALUES ($1,$2,$3,1,$4)",
    [id, subtotal / 100, (subtotal - cash) / 100, (cash + 100) / 100],
  );
  await db.query(
    "INSERT INTO order_items (order_id,product_id,price,quantity,line_total) VALUES ($1,'product-1',2,$2,$3)",
    [id, quantity, subtotal / 100],
  );
  await db.query("UPDATE orders SET pricing_snapshot=$2::jsonb WHERE id=$1", [
    id,
    JSON.stringify(snapshot),
  ]);
}

async function seedRefund(
  db: PGlite,
  input: {
    id: string;
    quantity?: number;
    cash?: number;
    delivery?: number;
    orderId?: string;
    createdAt?: string;
    total?: number;
    productId?: string;
  },
) {
  const cash = input.cash ?? 0;
  const delivery = input.delivery ?? 0;
  await db.query(
    `
    INSERT INTO order_refunds
      (id,order_id,author_id,request_id,request_fingerprint,reference,reason,delivery_kopecks,total_kopecks,created_at)
    VALUES ($1::text,$2,'admin',md5($1::text)::uuid,repeat('a',64),$1::text,'Already refunded',$3,$4,$5::timestamp)
  `,
    [
      input.id,
      input.orderId ?? "order-1",
      delivery,
      input.total ?? cash + delivery,
      input.createdAt ?? "2026-09-20 12:00:00",
    ],
  );
  if (input.quantity !== undefined) {
    await db.query(
      `
      INSERT INTO order_refund_items (refund_id,product_id,title,quantity,amount_kopecks)
      VALUES ($1,$2,'Product',$3,$4)
    `,
      [input.id, input.productId ?? "product-1", input.quantity, cash],
    );
  }
}

async function itemFacts(db: PGlite) {
  return (
    await db.query(`
    SELECT refund_id, previous_quantity, loyalty_points::text AS points
    FROM order_refund_items ORDER BY refund_id
  `)
  ).rows;
}

async function assertRollback(db: PGlite, pattern: RegExp) {
  const refundsBefore = (
    await db.query("SELECT * FROM order_refunds ORDER BY id")
  ).rows;
  const itemsBefore = (
    await db.query(
      "SELECT * FROM order_refund_items ORDER BY refund_id,product_id",
    )
  ).rows;
  await assert.rejects(applyMigration(db), pattern);
  await db.exec("ROLLBACK");
  assert.deepEqual(
    (await db.query("SELECT * FROM order_refunds ORDER BY id")).rows,
    refundsBefore,
  );
  assert.deepEqual(
    (
      await db.query(
        "SELECT * FROM order_refund_items ORDER BY refund_id,product_id",
      )
    ).rows,
    itemsBefore,
  );
  assert.deepEqual(
    (
      await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name IN ('order_refund_items','order_refunds') AND column_name IN ('previous_quantity','loyalty_points')
  `)
    ).rows,
    [],
  );
  assert.deepEqual(
    (
      await db.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_name IN ('order_refund_events','loyalty_refund_receipts')
  `)
    ).rows,
    [],
  );
  assert.deepEqual(
    (
      await db.query(`
    SELECT tgname,tgenabled FROM pg_trigger
    WHERE tgname IN ('order_refunds_immutable','order_refund_items_immutable') ORDER BY tgname
  `)
    ).rows,
    [
      { tgname: "order_refund_items_immutable", tgenabled: "O" },
      { tgname: "order_refunds_immutable", tgenabled: "O" },
    ],
  );
  await assert.rejects(
    db.exec("UPDATE order_refund_items SET quantity=quantity"),
    /immutable/,
  );
}

function currentRefundSql(
  input: {
    id?: string;
    previous?: number;
    quantity?: number;
    cash?: number;
    points?: number;
    itemPoints?: number;
    total?: number;
    publish?: boolean;
    occurredAt?: string;
  } = {},
) {
  const id = input.id ?? "new-refund";
  return `
    INSERT INTO order_refunds
      (id,order_id,author_id,request_id,request_fingerprint,reference,reason,delivery_kopecks,total_kopecks,loyalty_points,created_at)
    VALUES ('${id}','order-1','admin',md5('${id}')::uuid,repeat('b',64),'${id}','Already refunded',0,${input.total ?? input.cash ?? 160},${input.points ?? 2},'2026-09-20 13:00:00');
    INSERT INTO order_refund_items
      (refund_id,product_id,title,quantity,amount_kopecks,previous_quantity,loyalty_points)
    VALUES ('${id}','product-1','Product',${input.quantity ?? 1},${input.cash ?? 160},${input.previous ?? 0},${input.itemPoints ?? input.points ?? 2});
    ${
      input.publish === false
        ? ""
        : `INSERT INTO order_refund_events (id,refund_id,occurred_at)
      VALUES ('event-${id}','${id}','${input.occurredAt ?? "2026-09-20 13:00:00"}');`
    }
  `;
}

async function assertTransactionRejected(
  db: PGlite,
  sql: string,
  pattern: RegExp,
) {
  await assert.rejects(db.exec(`BEGIN; ${sql} COMMIT;`), pattern);
  await db.exec("ROLLBACK");
}

describe("refund events migration", () => {
  it("installs with no historical refunds", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db);
      await applyMigration(db);
      assert.deepEqual(await itemFacts(db), []);
      assert.deepEqual(
        (await db.query("SELECT * FROM order_refund_events")).rows,
        [],
      );
      assert.deepEqual(
        (await db.query("SELECT * FROM loyalty_refund_receipts")).rows,
        [],
      );
    } finally {
      await db.close();
    }
  });

  it("backfills promo cash in original group order and delivery-only refunds", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [
        { quantity: 1, cash: 159, points: 0 },
        { quantity: 3, cash: 160, points: 0 },
      ]);
      // Equal timestamps deliberately exercise the deterministic id tie-break.
      await seedRefund(db, { id: "r2", quantity: 2, cash: 320 });
      await seedRefund(db, { id: "r1", quantity: 1, cash: 159 });
      await seedRefund(db, { id: "r0", delivery: 100 });
      await applyMigration(db);
      assert.deepEqual(await itemFacts(db), [
        { refund_id: "r1", previous_quantity: 0, points: "0" },
        { refund_id: "r2", previous_quantity: 1, points: "0" },
      ]);
      assert.deepEqual(
        (
          await db.query(
            "SELECT id,loyalty_points::text AS points FROM order_refunds ORDER BY id",
          )
        ).rows,
        [
          { id: "r0", points: "0" },
          { id: "r1", points: "0" },
          { id: "r2", points: "0" },
        ],
      );
      assert.deepEqual(
        (
          await db.query(`
        SELECT e.refund_id, e.occurred_at = r.created_at AS source_time
        FROM order_refund_events e JOIN order_refunds r ON r.id=e.refund_id ORDER BY e.refund_id
      `)
        ).rows,
        [
          { refund_id: "r0", source_time: true },
          { refund_id: "r1", source_time: true },
          { refund_id: "r2", source_time: true },
        ],
      );
      await assert.rejects(
        db.exec(
          "UPDATE order_refund_items SET previous_quantity=previous_quantity",
        ),
        /immutable/,
      );
      await assert.rejects(
        db.exec("DELETE FROM order_refunds WHERE id='r0'"),
        /immutable/,
      );
    } finally {
      await db.close();
    }
  });

  it("backfills one positive refund across differing points groups", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [
        { quantity: 1, cash: 140, points: 3 },
        { quantity: 3, cash: 160, points: 2 },
      ]);
      await seedRefund(db, { id: "r1", quantity: 2, cash: 300 });
      await applyMigration(db);
      assert.deepEqual(await itemFacts(db), [
        { refund_id: "r1", previous_quantity: 0, points: "5" },
      ]);
    } finally {
      await db.close();
    }
  });

  it("backfills split refunds with constant points independently of cash groups", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [
        { quantity: 1, cash: 150, points: 2 },
        { quantity: 3, cash: 160, points: 2 },
      ]);
      await seedRefund(db, { id: "r1", quantity: 1, cash: 150 });
      await seedRefund(db, { id: "r2", quantity: 2, cash: 320 });
      await applyMigration(db);
      assert.deepEqual(await itemFacts(db), [
        { refund_id: "r1", previous_quantity: 0, points: "2" },
        { refund_id: "r2", previous_quantity: 1, points: "4" },
      ]);
    } finally {
      await db.close();
    }
  });

  it("rolls schema and audit guards back for ambiguous historical points", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [
        { quantity: 1, cash: 140, points: 3 },
        { quantity: 3, cash: 160, points: 2 },
      ]);
      await seedRefund(db, { id: "r1", quantity: 1, cash: 140 });
      await seedRefund(db, { id: "r2", quantity: 1, cash: 160 });
      await assertRollback(db, /ambiguous|historical|order/i);
    } finally {
      await db.close();
    }
  });

  for (const scenario of [
    "cash",
    "quantity",
    "snapshot",
    "missing-product",
    "total",
    "delivery",
  ] as const) {
    it(`aborts the complete backfill for corrupt historical ${scenario}`, async () => {
      const db = await createDatabase();
      try {
        await seedOrder(db);
        await seedRefund(db, {
          id: "r1",
          quantity: scenario === "quantity" ? 5 : 1,
          cash: scenario === "cash" ? 159 : scenario === "quantity" ? 800 : 160,
          productId: scenario === "missing-product" ? "missing" : undefined,
          total: scenario === "total" ? 161 : undefined,
          delivery: scenario === "delivery" ? 101 : 0,
        });
        if (scenario === "snapshot") {
          await db.exec(`
            ALTER TABLE orders DISABLE TRIGGER orders_immutable_pricing_snapshot;
            UPDATE orders SET pricing_snapshot=jsonb_set(pricing_snapshot,'{items,0,priceGroups,0,quantity}','5');
            ALTER TABLE orders ENABLE TRIGGER orders_immutable_pricing_snapshot;
          `);
        }
        await assertRollback(
          db,
          /refund|pricing|quantity|amount|product|delivery|total|order/i,
        );
      } finally {
        await db.close();
      }
    });
  }

  it("publishes a new complete refund atomically and keeps its source and event append-only", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [{ quantity: 4, cash: 160, points: 2 }]);
      await applyMigration(db);
      await db.exec(`BEGIN; ${currentRefundSql()} COMMIT;`);
      assert.deepEqual(await itemFacts(db), [
        { refund_id: "new-refund", previous_quantity: 0, points: "2" },
      ]);
      await assert.rejects(
        db.exec("UPDATE order_refund_events SET occurred_at=occurred_at"),
        /immutable/,
      );
      await assert.rejects(
        db.exec("DELETE FROM order_refund_events"),
        /immutable/,
      );
      await assert.rejects(
        db.exec("UPDATE order_refunds SET loyalty_points=loyalty_points"),
        /immutable/,
      );
      await assert.rejects(
        db.exec("UPDATE order_refund_items SET loyalty_points=loyalty_points"),
        /immutable/,
      );
      await assert.rejects(
        db.exec(`
        INSERT INTO order_refund_events (id,refund_id,occurred_at)
        SELECT 'duplicate',refund_id,occurred_at FROM order_refund_events
      `),
        /unique|duplicate/i,
      );
      await assert.rejects(
        db.exec(`
        INSERT INTO order_refund_items (refund_id,product_id,title,quantity,amount_kopecks,previous_quantity,loyalty_points)
        VALUES ('new-refund','another-product','Late addition',1,160,0,2)
      `),
        /immutable/,
      );
      await db.exec(
        `BEGIN; ${currentRefundSql({ id: "second", previous: 1 })} COMMIT;`,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM order_refund_events",
          )
        ).rows[0]?.count,
        2,
      );
    } finally {
      await db.close();
    }
  });

  it("rejects event/source mismatches and leaves no partial source rows", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [{ quantity: 4, cash: 160, points: 2 }]);
      await applyMigration(db);
      for (const input of [
        { occurredAt: "2026-09-20 13:00:01" },
        { cash: 159 },
        { points: 1 },
        { itemPoints: 1 },
        { previous: 1 },
        { quantity: 5, cash: 800, points: 10 },
        { total: 161 },
      ]) {
        await assertTransactionRejected(
          db,
          currentRefundSql(input),
          /refund|pricing|quantity|range|timestamp/i,
        );
        assert.deepEqual(
          (await db.query("SELECT id FROM order_refunds")).rows,
          [],
        );
        assert.deepEqual(
          (await db.query("SELECT id FROM order_refund_events")).rows,
          [],
        );
      }
      await assert.rejects(
        db.exec(`
        INSERT INTO order_refund_events VALUES ('missing','missing','2026-09-20',now())
      `),
        /missing/,
      );
      await db.exec("UPDATE orders SET payment_status='failed',paid_at=NULL");
      await assertTransactionRejected(db, currentRefundSql(), /paid order/);
    } finally {
      await db.close();
    }
  });

  it("requires a durable event at commit and checks complete totals with deferred constraints", async () => {
    const db = await createDatabase();
    try {
      await seedOrder(db, [{ quantity: 4, cash: 160, points: 2 }]);
      await applyMigration(db);
      await assertTransactionRejected(
        db,
        currentRefundSql({ publish: false }),
        /durable event/,
      );
      await assertTransactionRejected(
        db,
        currentRefundSql({ publish: false, total: 161 }),
        /totals/,
      );
      await assertTransactionRejected(
        db,
        currentRefundSql({ publish: false, points: 3, itemPoints: 2 }),
        /totals/,
      );
      // Deferred checks permit the header to precede its items and event.
      await db.exec(
        `BEGIN; ${currentRefundSql()} SET CONSTRAINTS ALL IMMEDIATE; COMMIT;`,
      );
      await assertTransactionRejected(
        db,
        currentRefundSql({ id: "overlap", previous: 0 }),
        /overlap|gaps/,
      );
      await assertTransactionRejected(
        db,
        currentRefundSql({ id: "gap", previous: 2 }),
        /overlap|gaps/,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM order_refunds",
          )
        ).rows[0]?.count,
        1,
      );
    } finally {
      await db.close();
    }
  });
});
