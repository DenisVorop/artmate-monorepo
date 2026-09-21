import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { ConflictException } from "@nestjs/common";

import type { Prisma } from "../src/generated/prisma/client";
import { readPurchaseRateSnapshot } from "../src/orders/pricing/purchase-rate";

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE orders (
      id TEXT PRIMARY KEY, user_id TEXT, currency TEXT DEFAULT 'RUB',
      total NUMERIC, delivery_price NUMERIC DEFAULT 0,
      subtotal NUMERIC DEFAULT 100000, discount NUMERIC DEFAULT 0,
      pricing_snapshot JSONB, loyalty_rate_percent INTEGER, loyalty_rate_version TEXT,
      payment_status TEXT DEFAULT 'paid', paid_at TIMESTAMP DEFAULT '2026-09-20',
      crm_status TEXT DEFAULT 'completed', completed_at TIMESTAMP DEFAULT '2026-09-20'
    );
    CREATE TABLE order_refunds (id TEXT PRIMARY KEY, order_id TEXT, total_kopecks BIGINT, delivery_kopecks BIGINT);
  `);
  const reads: Array<{ spendKopecks: string; invalid: boolean }> = [];
  const tx = {
    $queryRaw: async (query: Prisma.Sql) => {
      const result = await db.query<{ spendKopecks: string; invalid: boolean }>(
        query.text,
        query.values,
      );
      reads.push(...result.rows);
      return result.rows;
    },
  } as unknown as Prisma.TransactionClient;
  const snapshot = (userId: string | null = "buyer", orderId = "current") =>
    readPurchaseRateSnapshot(tx, { userId, orderId });
  return { db, snapshot, reads };
}

describe("checkout purchase-rate snapshot from published cash facts", () => {
  it("uses exact inclusive thresholds and excludes delivery from cumulative spending", async () => {
    const f = await fixture();
    try {
      assert.deepEqual(await f.snapshot(), {
        loyaltyRatePercent: 3,
        loyaltyRateVersion: "purchase-v1",
      });
      for (const [cash, rate] of [
        ["2999.99", 3],
        ["3000.00", 5],
        ["6999.99", 5],
        ["7000.00", 7],
        ["11999.99", 7],
        ["12000.00", 10],
      ] as const) {
        await f.db.query(
          "INSERT INTO orders (id,user_id,total,delivery_price) VALUES ('received','buyer',$1::numeric+500,500) ON CONFLICT (id) DO UPDATE SET total=excluded.total",
          [cash],
        );
        assert.equal((await f.snapshot()).loyaltyRatePercent, rate, cash);
      }
    } finally {
      await f.db.close();
    }
  });

  it("counts actual post-discount cash even with spent loyalty points, never gross/subtotal", async () => {
    const f = await fixture();
    try {
      await f.db
        .exec(`INSERT INTO orders (id,user_id,total,delivery_price,discount,pricing_snapshot)
        VALUES ('spent','buyer',3100,100,97000,'{"loyaltyDiscountKopecks":500000,"loyaltyPoints":25000}');`);
      assert.equal((await f.snapshot()).loyaltyRatePercent, 5);
      assert.equal(f.reads.at(-1)?.spendKopecks, "300000");
    } finally {
      await f.db.close();
    }
  });

  it("preaggregates multiple refund rows without multiplying cash and subtracts only refunded merchandise", async () => {
    const f = await fixture();
    try {
      await f.db.exec(`
        INSERT INTO orders (id,user_id,total,delivery_price) VALUES ('a','buyer',4600,100),('b','buyer',2510,10);
        INSERT INTO order_refunds VALUES ('r1','a',5050,50),('r2','a',10000,0),('delivery','b',1000,1000);
      `);
      assert.equal((await f.snapshot()).loyaltyRatePercent, 5);
      assert.equal(f.reads.at(-1)?.spendKopecks, "685000");
      await f.db.exec(
        "INSERT INTO order_refunds VALUES ('lower-tier','a',400001,0)",
      );
      assert.equal((await f.snapshot()).loyaltyRatePercent, 3);
      assert.equal(f.reads.at(-1)?.spendKopecks, "284999");
    } finally {
      await f.db.close();
    }
  });

  it("requires the exact attached owner and both paid and received facts, excluding current order", async () => {
    const f = await fixture();
    try {
      await f.db.exec(`
        INSERT INTO orders (id,user_id,total) VALUES ('valid','buyer',100),('other','other-buyer',99999),('current','buyer',99999);
        INSERT INTO orders (id,user_id,total,payment_status) VALUES ('unpaid','buyer',99999,'pending');
        INSERT INTO orders (id,user_id,total,paid_at) VALUES ('no-paid-at','buyer',99999,NULL);
        INSERT INTO orders (id,user_id,total,crm_status) VALUES ('undelivered','buyer',99999,'delivering');
        INSERT INTO orders (id,user_id,total,completed_at) VALUES ('no-completed-at','buyer',99999,NULL);
        INSERT INTO orders (id,user_id,total) VALUES ('guest',NULL,99999);
      `);
      assert.equal((await f.snapshot()).loyaltyRatePercent, 3);
      assert.equal(f.reads.at(-1)?.spendKopecks, "10000");
      const count = f.reads.length;
      assert.deepEqual(await f.snapshot(null), {
        loyaltyRatePercent: 3,
        loyaltyRateVersion: "purchase-v1",
      });
      assert.equal(
        f.reads.length,
        count,
        "Unowned checkout must not resolve or borrow another account's history",
      );
    } finally {
      await f.db.close();
    }
  });

  it("reads historical received cash while leaving its unknown historical rate NULL", async () => {
    const f = await fixture();
    try {
      await f.db.exec(
        "INSERT INTO orders (id,user_id,total) VALUES ('historical','buyer',7000)",
      );
      assert.equal((await f.snapshot()).loyaltyRatePercent, 7);
      assert.deepEqual(
        (
          await f.db.query(
            "SELECT loyalty_rate_percent,loyalty_rate_version FROM orders WHERE id='historical'",
          )
        ).rows,
        [{ loyalty_rate_percent: null, loyalty_rate_version: null }],
      );
    } finally {
      await f.db.close();
    }
  });

  it("aggregates with exact BigInt beyond the JavaScript safe integer boundary", async () => {
    const f = await fixture();
    try {
      await f.db.exec(
        "INSERT INTO orders (id,user_id,total) VALUES ('a','buyer',45035996273704.96),('b','buyer',45035996273704.97)",
      );
      assert.equal((await f.snapshot()).loyaltyRatePercent, 10);
      assert.equal(f.reads.at(-1)?.spendKopecks, "9007199254740993");
    } finally {
      await f.db.close();
    }
  });

  for (const scenario of [
    "negative-cash",
    "fractional-kopeck",
    "negative-delivery",
    "delivery-over-total",
    "currency",
    "refund-over-cash",
    "refund-over-delivery",
    "negative-refund",
    "refund-delivery-over-total",
  ] as const) {
    it(`rejects inconsistent ${scenario} without clamping spending`, async () => {
      const f = await fixture();
      try {
        await f.db.exec(
          "INSERT INTO orders (id,user_id,total,delivery_price) VALUES ('a','buyer',3100,100)",
        );
        const corruptions = {
          "negative-cash": "UPDATE orders SET total=-1",
          "fractional-kopeck": "UPDATE orders SET total=3100.001",
          "negative-delivery": "UPDATE orders SET delivery_price=-1",
          "delivery-over-total": "UPDATE orders SET delivery_price=3101",
          currency: "UPDATE orders SET currency='USD'",
          "refund-over-cash":
            "INSERT INTO order_refunds VALUES ('r','a',300001,0)",
          "refund-over-delivery":
            "INSERT INTO order_refunds VALUES ('r','a',10001,10001)",
          "negative-refund": "INSERT INTO order_refunds VALUES ('r','a',-1,0)",
          "refund-delivery-over-total":
            "INSERT INTO order_refunds VALUES ('r','a',1,2)",
        };
        await f.db.exec(corruptions[scenario]);
        await assert.rejects(f.snapshot(), ConflictException);
      } finally {
        await f.db.close();
      }
    });
  }

  it("rejects malformed aggregate responses instead of granting a default high rate", async () => {
    for (const rows of [
      [],
      [{ spendKopecks: "0", invalid: true }],
      [{ spendKopecks: 300000, invalid: false }],
      [{ spendKopecks: "-1", invalid: false }],
      [{ spendKopecks: "300000.5", invalid: false }],
      [
        { spendKopecks: "0", invalid: false },
        { spendKopecks: "0", invalid: false },
      ],
    ]) {
      const tx = {
        $queryRaw: async () => rows,
      } as unknown as Prisma.TransactionClient;
      await assert.rejects(
        readPurchaseRateSnapshot(tx, { userId: "buyer", orderId: "current" }),
        ConflictException,
      );
    }
  });
});
