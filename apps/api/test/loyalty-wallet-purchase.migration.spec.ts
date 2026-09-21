import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY,status TEXT DEFAULT 'active',deleted_at TIMESTAMP(3));
    CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY, user_id TEXT, checkout_actor_user_id TEXT,
      payment_status TEXT NOT NULL, paid_at TIMESTAMP(3),crm_status TEXT,completed_at TIMESTAMP(3),pricing_snapshot JSONB);
    CREATE TABLE order_refunds (id VARCHAR(32) PRIMARY KEY,order_id VARCHAR(32),loyalty_points BIGINT,
      total_kopecks BIGINT,delivery_kopecks BIGINT,created_at TIMESTAMP(3));
    CREATE TABLE order_refund_events (id TEXT PRIMARY KEY,refund_id VARCHAR(32) UNIQUE);
    -- Canonical pricing arithmetic is covered by its own migration suite. This
    -- fixture isolates purchase provenance, grant math, counter and wallet guards.
    CREATE FUNCTION validate_order_pricing_snapshot(order_row orders) RETURNS VOID LANGUAGE plpgsql AS $$
      BEGIN IF order_row.pricing_snapshot IS NULL THEN RAISE EXCEPTION 'Missing pricing'; END IF; END; $$;
    INSERT INTO users(id) VALUES ('user-1');
    INSERT INTO orders VALUES ('legacy','user-1',NULL,'paid',now(),'completed',now(),'{}');
  `);
  for (const name of [
    "20260920130000_loyalty_wallet",
    "20260920161000_loyalty_refund_restore",
    "20260920180000_loyalty_purchase_rewards",
  ]) {
    await db.exec(
      await readFile(
        resolve(__dirname, `../prisma/migrations/${name}/migration.sql`),
        "utf8",
      ),
    );
  }
  await db.exec(`BEGIN;
    INSERT INTO loyalty_members(id,user_id,terms_version,history_state) VALUES ('member-1','user-1','v1','ready');
    INSERT INTO loyalty_wallets(member_id) VALUES ('member-1');
    INSERT INTO orders(id,user_id,payment_status,paid_at,crm_status,completed_at,pricing_snapshot,loyalty_rate_percent,loyalty_rate_version)
      VALUES ('order-1','user-1','paid','2026-09-20 10:00:00','completed','2026-09-20 12:00:00',
        '{"itemsTotalKopecks":100000,"loyaltyDiscountKopecks":0}',5,'purchase-v1');
    COMMIT;`);
  return db;
}

function accountSql(granted = 250, refunded = 0) {
  return `INSERT INTO loyalty_purchase_accounts(order_id,member_id,rate_percent,rules_version,base_kopecks,granted_points,refunded_kopecks,occurred_at)
    VALUES ('order-1','member-1',5,'purchase-v1',100000,${granted},${refunded},'2026-09-20 12:00:00');`;
}

function creditSql(points = 250) {
  return `INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,purchase_order_id,occurred_at)
    VALUES ('credit','member-1',1,'purchase:order-1:credit','credit',${points},${points},0,${points},0,'purchase:order-1','purchase-v1','order-1','2026-09-20 12:00:00');
    UPDATE loyalty_wallets SET balance_points=${points},revision=1;`;
}

async function reject(db: PGlite, sql: string, pattern: RegExp) {
  await assert.rejects(db.exec(`BEGIN; ${sql} COMMIT;`), pattern);
  await db.exec("ROLLBACK");
}

describe("purchase reward migration", () => {
  it("fixes checkout rates only at first snapshot and never backfills historic rates", async () => {
    const db = await database();
    try {
      assert.deepEqual(
        (
          await db.query(
            "SELECT loyalty_rate_percent,loyalty_rate_version FROM orders WHERE id='legacy'",
          )
        ).rows,
        [{ loyalty_rate_percent: null, loyalty_rate_version: null }],
      );
      await reject(
        db,
        "UPDATE orders SET loyalty_rate_percent=5,loyalty_rate_version='purchase-v1' WHERE id='legacy';",
        /immutable/,
      );
      await reject(
        db,
        "UPDATE orders SET loyalty_rate_percent=7 WHERE id='order-1';",
        /immutable/,
      );
      await reject(
        db,
        "INSERT INTO orders(id,payment_status,loyalty_rate_percent) VALUES ('bad','pending',5);",
        /rate_pair/,
      );
      await db.exec(`INSERT INTO orders(id,payment_status) VALUES ('checkout','pending');
        UPDATE orders SET pricing_snapshot='{}',loyalty_rate_percent=3,loyalty_rate_version='purchase-v1' WHERE id='checkout';`);
      await reject(
        db,
        "UPDATE orders SET loyalty_rate_percent=10 WHERE id='checkout';",
        /immutable/,
      );
    } finally {
      await db.close();
    }
  });

  it("requires a matching paid completed buyer, exact grant and atomic source-bound ledger", async () => {
    const db = await database();
    try {
      await reject(db, accountSql(251), /initial grant/);
      await reject(db, accountSql(), /does not match its loyalty ledger/);
      await reject(
        db,
        `UPDATE orders SET user_id=NULL WHERE id='order-1'; ${accountSql()}`,
        /eligible completed paid/,
      );
      await reject(
        db,
        `UPDATE orders SET payment_status='pending' WHERE id='order-1'; ${accountSql()}`,
        /eligible completed paid/,
      );
      await reject(
        db,
        `UPDATE orders SET crm_status='delivering' WHERE id='order-1'; ${accountSql()}`,
        /eligible completed paid/,
      );
      await reject(
        db,
        `UPDATE loyalty_members SET history_state='pending'; ${accountSql()}`,
        /eligible completed paid/,
      );
      await reject(
        db,
        `UPDATE users SET status='blocked'; ${accountSql()}`,
        /eligible completed paid/,
      );
      await reject(
        db,
        `UPDATE users SET deleted_at=now(); ${accountSql()}`,
        /eligible completed paid/,
      );
      await db.exec(`BEGIN; ${accountSql()} ${creditSql()} COMMIT;`);
      await reject(
        db,
        "UPDATE loyalty_purchase_accounts SET rate_percent=7;",
        /immutable/,
      );
      await reject(db, "DELETE FROM loyalty_purchase_accounts;", /permanent/);
      await reject(
        db,
        `INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,occurred_at)
        VALUES ('fake','member-1',2,'purchase:order-1:fake','credit',1,1,0,251,0,'purchase:order-1','purchase-v1',now());`,
        /structured source/,
      );
    } finally {
      await db.close();
    }
  });

  it("accounts full requested reversal but preserves holds and allows blocked/cancelled-order correction", async () => {
    const db = await database();
    try {
      await db.exec(`BEGIN; ${accountSql()} ${creditSql()}
        INSERT INTO loyalty_reservations(id,order_id,member_id,points) VALUES ('hold','legacy','member-1',230);
        INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,reservation_id,occurred_at)
          VALUES ('reserve','member-1',2,'reserve','reserve',230,0,230,250,230,'order:legacy','v1','hold',now());
        UPDATE loyalty_wallets SET reserved_points=230,revision=2;
        COMMIT;
        INSERT INTO order_refunds VALUES ('refund-1','order-1',0,50000,0,'2026-09-21 10:00:00');
        INSERT INTO order_refund_events VALUES ('event-1','refund-1');
        UPDATE loyalty_members SET status='blocked';
        UPDATE orders SET crm_status='cancelled' WHERE id='order-1';`);
      const reverseSql = (
        delta: number,
      ) => `INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,purchase_order_id,occurred_at)
        VALUES ('reverse','member-1',3,'purchase:order-1:reversal:50000','reversal',125,${delta},0,${250 + delta},230,'purchase:order-1','purchase-v1','order-1','2026-09-21 10:00:00');
        UPDATE loyalty_wallets SET balance_points=${250 + delta},revision=3;`;
      await reject(db, reverseSql(-19), /only available points/);
      await reject(db, reverseSql(-20), /does not match its loyalty ledger/);
      await db.exec(`BEGIN; ${reverseSql(-20)}
        UPDATE loyalty_purchase_accounts SET refunded_kopecks=50000,reversed_points=125; COMMIT;`);
      assert.deepEqual(
        (
          await db.query(
            "SELECT balance_points::int AS balance,reserved_points::int AS reserved FROM loyalty_wallets",
          )
        ).rows,
        [{ balance: 230, reserved: 230 }],
      );
      await reject(
        db,
        "UPDATE loyalty_purchase_accounts SET reversed_points=20;",
        /remaining entitlement/,
      );
    } finally {
      await db.close();
    }
  });

  it("grants net known refunds only, excludes delivery and assigns zero grant when points were spent", async () => {
    const db = await database();
    try {
      await db.exec(`INSERT INTO order_refunds VALUES ('refund-1','order-1',0,50100,100,'2026-09-20 11:00:00');
        INSERT INTO order_refund_events VALUES ('event-1','refund-1');`);
      await reject(db, accountSql(250, 50000), /initial grant/);
      await db.exec(
        `BEGIN; ${accountSql(125, 50000)} ${creditSql(125)} COMMIT;`,
      );
      await db.exec(`INSERT INTO orders(id,user_id,payment_status,paid_at,crm_status,completed_at,pricing_snapshot,loyalty_rate_percent,loyalty_rate_version)
        SELECT 'spent',user_id,payment_status,paid_at,crm_status,completed_at,'{"itemsTotalKopecks":100000,"loyaltyDiscountKopecks":200}',loyalty_rate_percent,loyalty_rate_version FROM orders WHERE id='order-1';
        INSERT INTO loyalty_purchase_accounts(order_id,member_id,rate_percent,rules_version,base_kopecks,granted_points,refunded_kopecks,occurred_at)
          VALUES ('spent','member-1',5,'purchase-v1',100000,0,0,'2026-09-20 12:00:00');`);
    } finally {
      await db.close();
    }
  });
});
