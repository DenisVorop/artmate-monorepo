import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY, checkout_actor_user_id TEXT, payment_status TEXT NOT NULL, paid_at TIMESTAMP(3));
    CREATE TABLE order_refunds (id VARCHAR(32) PRIMARY KEY, order_id VARCHAR(32), loyalty_points BIGINT NOT NULL, created_at TIMESTAMP(3) NOT NULL);
    INSERT INTO users VALUES ('user-1');
    INSERT INTO orders VALUES ('order-1','user-1','paid','2026-09-20 12:00:00'),('order-2','user-1','paid','2026-09-20 12:00:00');
    INSERT INTO order_refunds VALUES
      ('refund-1','order-1',10,'2026-09-20 13:00:00'),
      ('refund-2','order-1',15,'2026-09-20 14:00:00'),
      ('refund-3','order-1',1,'2026-09-20 15:00:00'),
      ('wrong-order','order-2',10,'2026-09-20 13:00:00');
  `);
  for (const migration of [
    "20260920130000_loyalty_wallet",
    "20260920161000_loyalty_refund_restore",
  ]) {
    await db.exec(
      await readFile(
        resolve(__dirname, `../prisma/migrations/${migration}/migration.sql`),
        "utf8",
      ),
    );
  }
  await db.exec(`
    BEGIN;
    INSERT INTO loyalty_members(id,user_id,terms_version,status) VALUES ('member-1','user-1','v1','blocked');
    INSERT INTO loyalty_wallets(member_id,balance_points,reserved_points,revision) VALUES ('member-1',75,0,3);
    INSERT INTO loyalty_reservations(id,order_id,member_id,points,status) VALUES ('reservation-1','order-1','member-1',25,'consumed');
    INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,reservation_id,occurred_at)
    VALUES
      ('credit','member-1',1,'credit','credit',100,100,0,100,0,'credit','v1',NULL,now()),
      ('reserve','member-1',2,'reserve','reserve',25,0,25,100,25,'order:order-1','order-spend-v1','reservation-1',now()),
      ('consume','member-1',3,'consume','consume',25,-25,-25,75,0,'order:order-1','order-spend-v1','reservation-1',now());
    COMMIT;
  `);
  return db;
}

function restoreSql(
  refundId: string,
  points: number,
  options: { kind?: string; reservationId?: string; sourceKey?: string } = {},
) {
  return `BEGIN;
    INSERT INTO loyalty_operations(id,member_id,sequence,operation_key,kind,requested_points,balance_delta,reserved_delta,balance_after,reserved_after,source_key,rules_version,reservation_id,refund_id,occurred_at)
    SELECT 'restore-${refundId}','member-1',w.revision+1,'refund:${refundId}:restore','${options.kind ?? "restore"}',${points},${points},0,w.balance_points+${points},0,
      '${options.sourceKey ?? `refund:${refundId}`}','order-spend-v1',${options.reservationId === "NULL" ? "NULL" : `'${options.reservationId ?? "reservation-1"}'`},'${refundId}',r.created_at
    FROM loyalty_wallets w JOIN order_refunds r ON r.id='${refundId}' WHERE w.member_id='member-1';
    UPDATE loyalty_wallets SET balance_points=balance_points+${points},revision=revision+1 WHERE member_id='member-1';
    COMMIT;`;
}

async function rejectsTransaction(db: PGlite, sql: string, pattern: RegExp) {
  await assert.rejects(db.exec(sql), pattern);
  await db.exec("ROLLBACK");
}

describe("loyalty refund RESTORE migration", () => {
  it("preserves full accounting while restoring partial refunds to a consumed reservation", async () => {
    const db = await createDatabase();
    try {
      await db.exec(restoreSql("refund-1", 10));
      await db.exec(restoreSql("refund-2", 15));
      const wallet = await db.query<{
        balance: number;
        reserved: number;
        revision: number;
      }>(
        "SELECT balance_points::int AS balance,reserved_points::int AS reserved,revision::int AS revision FROM loyalty_wallets",
      );
      assert.deepEqual(wallet.rows, [
        { balance: 100, reserved: 0, revision: 5 },
      ]);
      await rejectsTransaction(
        db,
        restoreSql("refund-3", 1),
        /exceed originally consumed points/,
      );
      await rejectsTransaction(
        db,
        "BEGIN; UPDATE loyalty_wallets SET balance_points=101; COMMIT;",
        /does not match its ledger/,
      );
    } finally {
      await db.close();
    }
  });

  it("rejects wrong source, amount, reservation and operation/refund linkage", async () => {
    const db = await createDatabase();
    try {
      await rejectsTransaction(
        db,
        restoreSql("wrong-order", 10),
        /does not match its completed refund/,
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 11),
        /does not match its completed refund/,
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10, { sourceKey: "other" }),
        /does not match its completed refund/,
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10, { reservationId: "NULL" }),
        /reservation is missing/,
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10, { kind: "credit", reservationId: "NULL" }),
        /loyalty_operations_refund_kind/,
      );
      await db.exec(
        "UPDATE orders SET checkout_actor_user_id=NULL WHERE id='order-1'",
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10),
        /does not match its completed refund/,
      );
    } finally {
      await db.close();
    }
  });

  it("requires paid source state and keeps restore ledger append-only and unique per refund", async () => {
    const db = await createDatabase();
    try {
      await db.exec(
        "UPDATE orders SET payment_status='pending' WHERE id='order-1'",
      );
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10),
        /does not match its completed refund/,
      );
      await db.exec(
        "UPDATE orders SET payment_status='paid' WHERE id='order-1'",
      );
      await db.exec(restoreSql("refund-1", 10));
      await rejectsTransaction(
        db,
        restoreSql("refund-1", 10),
        /unique constraint/,
      );
      await assert.rejects(
        db.exec("DELETE FROM loyalty_operations WHERE kind::text='restore'"),
        /append-only/,
      );
      await assert.rejects(
        db.exec(
          "UPDATE loyalty_operations SET refund_id=NULL WHERE kind::text='restore'",
        ),
        /append-only/,
      );
    } finally {
      await db.close();
    }
  });
});
