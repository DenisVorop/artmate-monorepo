import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY,status TEXT DEFAULT 'active',deleted_at TIMESTAMP(3));
    CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY,user_id TEXT,checkout_actor_user_id TEXT,
      payment_status TEXT NOT NULL,paid_at TIMESTAMP(3),crm_status TEXT,completed_at TIMESTAMP(3),
      created_at TIMESTAMP(3),pricing_snapshot JSONB,currency TEXT DEFAULT 'RUB',
      subtotal NUMERIC,discount NUMERIC,delivery_price NUMERIC,total NUMERIC);
    CREATE TABLE order_items (order_id VARCHAR(32),product_id TEXT,price NUMERIC,quantity INTEGER,line_total NUMERIC);
    CREATE TABLE order_history (id TEXT PRIMARY KEY,order_id VARCHAR(32),event_type TEXT,payload JSONB,created_at TIMESTAMP(3));
    CREATE TABLE order_refunds (id VARCHAR(32) PRIMARY KEY,order_id VARCHAR(32),loyalty_points BIGINT DEFAULT 0,
      total_kopecks BIGINT,delivery_kopecks BIGINT,created_at TIMESTAMP(3));
    CREATE TABLE order_refund_events (id TEXT PRIMARY KEY,refund_id VARCHAR(32) UNIQUE,occurred_at TIMESTAMP(3));
  `);
  // Reuse the production pricing validator, including order/item arithmetic.
  const pricing = await readFile(
    resolve(
      __dirname,
      "../prisma/migrations/20260920120000_order_pricing_snapshot/migration.sql",
    ),
    "utf8",
  );
  await db.exec(
    pricing.slice(
      pricing.indexOf("CREATE FUNCTION order_pricing_uint"),
      pricing.indexOf("\nDO $$"),
    ),
  );
  for (const name of [
    "20260920130000_loyalty_wallet",
    "20260920161000_loyalty_refund_restore",
    "20260920180000_loyalty_purchase_rewards",
    "20260920190000_loyalty_purchase_history",
  ]) {
    try {
      await db.exec(
        await readFile(
          resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
          "utf8",
        ),
      );
    } catch (error) {
      await db.close();
      throw new Error(`Failed migration ${name}`, { cause: error });
    }
  }
  await db.exec(`INSERT INTO users(id) VALUES ('user-1'),('other');
    BEGIN;
    INSERT INTO loyalty_members(id,user_id,terms_version) VALUES ('member-1','user-1','v1');
    INSERT INTO loyalty_wallets(member_id) VALUES ('member-1');
    INSERT INTO loyalty_purchase_history_syncs(member_id) VALUES ('member-1');
    COMMIT;`);
  await order(db, "prior", 300000, "2026-09-01", "2026-09-02");
  await order(db, "target", 100000, "2026-09-05", "2026-09-06");
  return db;
}

async function order(
  db: PGlite,
  id: string,
  cash: number,
  created: string,
  completed: string,
) {
  const snapshot = {
    version: 1,
    currency: "RUB",
    subtotalKopecks: cash,
    promoDiscountKopecks: 0,
    loyaltyDiscountKopecks: 0,
    discountKopecks: 0,
    itemsTotalKopecks: cash,
    deliveryKopecks: 10000,
    totalKopecks: cash + 10000,
    items: [
      {
        id: "product",
        unitPriceKopecks: cash,
        quantity: 1,
        subtotalKopecks: cash,
        promoDiscountKopecks: 0,
        loyaltyPoints: 0,
        loyaltyDiscountKopecks: 0,
        totalKopecks: cash,
        priceGroups: [
          {
            quantity: 1,
            unitPriceKopecks: cash,
            totalKopecks: cash,
            promoDiscountPerUnitKopecks: 0,
            loyaltyPointsPerUnit: 0,
          },
        ],
      },
    ],
  };
  await db.query(
    `INSERT INTO orders(id,user_id,payment_status,paid_at,crm_status,completed_at,created_at,
      pricing_snapshot,subtotal,discount,delivery_price,total)
    VALUES ($1,'user-1','paid',$2,'completed',$3,$2,$4,$5,0,100,$6)`,
    [
      id,
      created,
      completed,
      JSON.stringify(snapshot),
      cash / 100,
      (cash + 10000) / 100,
    ],
  );
  await db.query("INSERT INTO order_items VALUES ($1,'product',$2,1,$2)", [
    id,
    cash / 100,
  ]);
}

const activate = `UPDATE loyalty_purchase_history_syncs SET active_transaction_id=txid_current(),completed_at=NULL;`;
const finish = `UPDATE loyalty_purchase_history_syncs SET active_transaction_id=NULL,completed_at=clock_timestamp();`;
function account(rate = 5, spend = 300000, points = 250) {
  return `INSERT INTO loyalty_purchase_accounts(order_id,member_id,rate_percent,rules_version,
    historical_version,historical_spend_kopecks,base_kopecks,granted_points,refunded_kopecks,occurred_at)
    VALUES ('target','member-1',${rate},'purchase-v1','purchase-history-v1',${spend},100000,${points},0,'2026-09-06');`;
}
function credit(points = 250) {
  return `INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,
    balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,purchase_order_id,occurred_at)
    VALUES ('credit','member-1',1,'purchase:target:credit','credit',${points},${points},0,${points},0,
      'purchase:target','purchase-v1','target','2026-09-06');
    UPDATE loyalty_wallets SET balance_points=${points},revision=1;`;
}
async function reject(db: PGlite, sql: string, pattern: RegExp) {
  await assert.rejects(db.exec(`BEGIN; ${sql} COMMIT;`), pattern);
  await db.exec("ROLLBACK");
}
async function spend(db: PGlite) {
  return (
    await db.query<{ spend: string }>(
      "SELECT historical_purchase_spend('target')::text AS spend",
    )
  ).rows[0]!.spend;
}

describe("historical purchase migration", () => {
  it("records an atomic source-bound historical credit without changing original rates or member readiness", async () => {
    const db = await database();
    try {
      await reject(db, account() + credit(), /eligible completed paid/);
      await reject(db, activate + account(7), /rate does not match/);
      await reject(db, activate + account(5, 300001), /rate does not match/);
      await reject(db, activate + account(5, 300000, 251), /initial grant/);
      await reject(
        db,
        activate + account(),
        /does not match its loyalty ledger/,
      );
      await db.exec(
        `BEGIN; ${activate} ${account()} ${credit()} ${finish} COMMIT;`,
      );
      assert.deepEqual(
        (await db.query("SELECT history_state::text FROM loyalty_members"))
          .rows,
        [{ history_state: "pending" }],
      );
      assert.deepEqual(
        (
          await db.query(
            "SELECT loyalty_rate_percent,loyalty_rate_version FROM orders WHERE id='target'",
          )
        ).rows,
        [{ loyalty_rate_percent: null, loyalty_rate_version: null }],
      );
      assert.equal(
        (
          await db.query<{ active_transaction_id: null }>(
            "SELECT active_transaction_id FROM loyalty_purchase_history_syncs",
          )
        ).rows[0]!.active_transaction_id,
        null,
      );
      await reject(
        db,
        "UPDATE loyalty_purchase_accounts SET historical_version=NULL,historical_spend_kopecks=NULL;",
        /immutable/,
      );
      await reject(
        db,
        "UPDATE loyalty_purchase_accounts SET historical_spend_kopecks=300001;",
        /immutable/,
      );
      await reject(db, "DELETE FROM loyalty_purchase_accounts;", /permanent/);
      await reject(db, credit(), /initial grant/);
    } finally {
      await db.close();
    }
  });

  it("requires current transaction authorization even for READY legacy orders, and never authorizes blocked/failed/inactive buyers", async () => {
    const db = await database();
    try {
      for (const change of [
        "UPDATE loyalty_members SET status='blocked';",
        "UPDATE loyalty_members SET history_state='failed';",
        "UPDATE users SET status='blocked' WHERE id='user-1';",
        "UPDATE users SET deleted_at=now() WHERE id='user-1';",
      ])
        await reject(
          db,
          change + activate + account() + credit(),
          /eligible completed paid/,
        );
      await db.exec("UPDATE loyalty_members SET history_state='ready';");
      await reject(db, account() + credit(), /active history transaction/);
      await db.exec(activate);
      await reject(db, account() + credit(), /active history transaction/);
      await db.exec(
        `BEGIN; ${activate} ${account()} ${credit()} ${finish} COMMIT;`,
      );
    } finally {
      await db.close();
    }
  });

  it("keeps frozen rates authoritative and rejects historical metadata for a frozen order", async () => {
    const db = await database();
    try {
      // A new checkout may set a rate only together with its initial snapshot.
      await db.exec(`INSERT INTO orders(id,payment_status) VALUES ('frozen','pending');
        UPDATE orders SET pricing_snapshot=(SELECT pricing_snapshot FROM orders WHERE id='target'),
          loyalty_rate_percent=7,loyalty_rate_version='purchase-v1',user_id='user-1',payment_status='paid',
          paid_at='2026-09-05',crm_status='completed',completed_at='2026-09-06',created_at='2026-09-05',
          subtotal=1000,discount=0,delivery_price=100,total=1100 WHERE id='frozen';
        INSERT INTO order_items VALUES ('frozen','product',1000,1,1000);`);
      await reject(
        db,
        activate + account(7, 300000, 350).replace("'target'", "'frozen'"),
        /frozen checkout rate/,
      );
      const frozenAccount = account(7, 300000, 350)
        .replace("'target'", "'frozen'")
        .replace("'purchase-history-v1',300000", "NULL,NULL");
      await db.exec(
        `BEGIN; ${activate} ${frozenAccount} ${credit(350).replaceAll("target", "frozen")} ${finish} COMMIT;`,
      );
      await reject(
        db,
        "UPDATE orders SET loyalty_rate_percent=3,loyalty_rate_version='purchase-v1' WHERE id='target';",
        /immutable/,
      );
    } finally {
      await db.close();
    }
  });

  it("uses strictly earlier payment, completion and refunds, excluding delivery and other owners", async () => {
    const db = await database();
    try {
      assert.equal(await spend(db), "300000");
      await order(db, "equal", 700000, "2026-09-05", "2026-09-05");
      await order(db, "other", 700000, "2026-09-01", "2026-09-02");
      await db.exec("UPDATE orders SET user_id='other' WHERE id='other';");
      assert.equal(await spend(db), "300000");
      await db.exec(`INSERT INTO order_refunds(id,order_id,total_kopecks,delivery_kopecks,created_at)
        VALUES ('refund','prior',10100,10000,'2026-09-05');
        INSERT INTO order_refund_events VALUES ('event','refund','2026-09-05');`);
      assert.equal(await spend(db), "300000");
      await db.exec(
        `UPDATE order_refunds SET created_at='2026-09-04'; UPDATE order_refund_events SET occurred_at='2026-09-04';`,
      );
      assert.equal(await spend(db), "299900");
      await db.exec(
        `BEGIN; ${activate} ${account(3, 299900, 150)} ${credit(150)} ${finish} COMMIT;`,
      );
    } finally {
      await db.close();
    }
  });

  it("reconstructs completion exits/reentry at checkout and rejects incomplete chains", async () => {
    const db = await database();
    try {
      await db.exec(`INSERT INTO order_history VALUES
        ('exit','prior','status_changed','{"fromStatus":"completed","toStatus":"delivering"}','2026-09-03'),
        ('return','prior','status_changed','{"fromStatus":"delivering","toStatus":"completed"}','2026-09-06');`);
      assert.equal(await spend(db), "0");
      await db.exec(
        "UPDATE order_history SET created_at='2026-09-05' WHERE id='return';",
      );
      assert.equal(await spend(db), "0");
      await db.exec(
        "UPDATE order_history SET created_at='2026-09-04' WHERE id='return';",
      );
      assert.equal(await spend(db), "300000");
      await reject(
        db,
        "UPDATE order_history SET created_at='2026-09-03' WHERE id='return'; SELECT historical_purchase_spend('target');",
        /status history/,
      );
      await reject(
        db,
        "UPDATE order_history SET payload='{}' WHERE id='return'; SELECT historical_purchase_spend('target');",
        /status history/,
      );
      await reject(
        db,
        "UPDATE orders SET crm_status='cancelled' WHERE id='prior'; SELECT historical_purchase_spend('target');",
        /status history/,
      );
    } finally {
      await db.close();
    }
  });

  it("rejects malformed pricing, payment dates and unpublished or mismatched refunds", async () => {
    const db = await database();
    try {
      for (const change of [
        "UPDATE orders SET currency='USD' WHERE id='prior';",
        "UPDATE orders SET total=99 WHERE id='prior';",
        "UPDATE orders SET pricing_snapshot='{}' WHERE id='target';",
        "UPDATE orders SET paid_at=NULL WHERE id='prior';",
        "UPDATE orders SET completed_at='2026-08-01' WHERE id='prior';",
        `INSERT INTO order_refunds(id,order_id,total_kopecks,delivery_kopecks,created_at) VALUES ('r','prior',100,0,'2026-09-03');`,
        `INSERT INTO order_refunds(id,order_id,total_kopecks,delivery_kopecks,created_at) VALUES ('r','prior',300001,0,'2026-09-03');
          INSERT INTO order_refund_events VALUES ('e','r','2026-09-03');`,
        `INSERT INTO order_refunds(id,order_id,total_kopecks,delivery_kopecks,created_at) VALUES ('r','prior',100,0,'2026-09-03');
          INSERT INTO order_refund_events VALUES ('e','r','2026-09-04');`,
      ])
        await reject(db, change + activate + account() + credit(), /Invalid/);
    } finally {
      await db.close();
    }
  });

  it("accepts the persisted order_created null initial transition and rejects null elsewhere", async () => {
    const db = await database();
    try {
      await db.exec(`INSERT INTO order_history VALUES
        ('created','prior','status_changed','{"fromStatus":null,"source":"order_created","toStatus":"waiting_payment"}','2026-09-01'),
        ('paid','prior','status_changed','{"fromStatus":"waiting_payment","toStatus":"paid"}','2026-09-01 01:00:00'),
        ('completed','prior','status_changed','{"fromStatus":"paid","toStatus":"completed"}','2026-09-02');`);
      assert.equal(await spend(db), "300000");
      for (const change of [
        `UPDATE order_history SET payload=payload-'source' WHERE id='created';`,
        `UPDATE order_history SET payload=payload-'fromStatus' WHERE id='created';`,
        `UPDATE order_history SET payload=jsonb_set(payload,'{source}','"crm"') WHERE id='created';`,
        `UPDATE order_history SET payload=jsonb_set(payload,'{toStatus}','"paid"') WHERE id='created';`,
        `UPDATE order_history SET payload='{"fromStatus":null,"source":"order_created","toStatus":"waiting_payment"}' WHERE id='paid';`,
        `UPDATE order_history SET payload=jsonb_set(payload,'{fromStatus}','null') WHERE id='completed';`,
      ]) {
        await reject(
          db,
          change + "SELECT historical_purchase_spend('target');",
          /status history/,
        );
      }
      await db.exec(
        `BEGIN; ${activate} ${account()} ${credit()} ${finish} COMMIT;`,
      );
    } finally {
      await db.close();
    }
  });

  it("reverses historical grants after completion with no active context even for a blocked buyer", async () => {
    const db = await database();
    try {
      await db.exec(`BEGIN; ${activate} ${account()} ${credit()} ${finish} COMMIT;
        UPDATE loyalty_members SET status='blocked';
        UPDATE orders SET crm_status='cancelled' WHERE id='target';
        INSERT INTO order_refunds(id,order_id,total_kopecks,delivery_kopecks,created_at)
          VALUES ('r','target',50000,0,'2026-09-07');
        INSERT INTO order_refund_events VALUES ('e','r','2026-09-07');
        BEGIN;
        INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,
          balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,purchase_order_id,occurred_at)
          VALUES ('reversal','member-1',2,'purchase:target:reversal:50000','reversal',125,-125,0,125,0,
            'purchase:target','purchase-v1','target','2026-09-07');
        UPDATE loyalty_wallets SET balance_points=125,revision=2;
        UPDATE loyalty_purchase_accounts SET refunded_kopecks=50000,reversed_points=125;
        COMMIT;`);
      assert.equal(
        (
          await db.query<{ points: number }>(
            "SELECT balance_points::int AS points FROM loyalty_wallets",
          )
        ).rows[0]!.points,
        125,
      );
    } finally {
      await db.close();
    }
  });
});
