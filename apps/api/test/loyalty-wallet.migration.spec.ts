import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

const migrationPath = resolve(
  __dirname,
  "../prisma/migrations/20260920130000_loyalty_wallet/migration.sql",
);

async function database() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE orders (id VARCHAR(32) PRIMARY KEY);
    INSERT INTO users VALUES ('user-1'), ('user-2');
    INSERT INTO orders VALUES ('order-1'), ('order-2');
  `);
  await db.exec(await readFile(migrationPath, "utf8"));
  return db;
}

async function transaction(db: PGlite, action: () => Promise<unknown>) {
  await db.exec("BEGIN");
  try {
    await action();
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

async function enroll(db: PGlite, suffix = "1") {
  await db.query(
    `INSERT INTO loyalty_members (id, user_id, terms_version)
     VALUES ($1, $2, 'v1')`,
    [`member-${suffix}`, `user-${suffix}`],
  );
  await db.query(`INSERT INTO loyalty_wallets (member_id) VALUES ($1)`, [
    `member-${suffix}`,
  ]);
}

type Operation = {
  id: string;
  sequence: number;
  kind: string;
  requested: number | string;
  balanceDelta: number | string;
  reservedDelta?: number;
  balanceAfter: number | string;
  reservedAfter?: number;
  reservationId?: string;
  memberId?: string;
  operationKey?: string;
};

async function insertOperation(db: PGlite, operation: Operation) {
  await db.query(
    `INSERT INTO loyalty_operations (
      id, member_id, sequence, operation_key, kind, requested_points,
      balance_delta, reserved_delta, balance_after, reserved_after,
      source_key, rules_version, reservation_id, occurred_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'test-source', 'v1', $11, now())`,
    [
      operation.id,
      operation.memberId ?? "member-1",
      operation.sequence,
      operation.operationKey ?? operation.id,
      operation.kind,
      operation.requested,
      operation.balanceDelta,
      operation.reservedDelta ?? 0,
      operation.balanceAfter,
      operation.reservedAfter ?? 0,
      operation.reservationId ?? null,
    ],
  );
}

async function writeOperation(db: PGlite, operation: Operation) {
  await insertOperation(db, operation);
  await db.query(
    `UPDATE loyalty_wallets SET balance_points = $2, reserved_points = $3,
      revision = $4 WHERE member_id = $1`,
    [
      operation.memberId ?? "member-1",
      operation.balanceAfter,
      operation.reservedAfter ?? 0,
      operation.sequence,
    ],
  );
}

async function credit(db: PGlite) {
  await transaction(db, () =>
    writeOperation(db, {
      id: "credit-1",
      sequence: 1,
      kind: "credit",
      requested: 100,
      balanceDelta: 100,
      balanceAfter: 100,
    }),
  );
}

async function reserve(db: PGlite) {
  await transaction(db, async () => {
    await db.exec(`INSERT INTO loyalty_reservations (id, member_id, order_id, points)
      VALUES ('reservation-1', 'member-1', 'order-1', 30)`);
    await writeOperation(db, {
      id: "reserve-1",
      sequence: 2,
      kind: "reserve",
      requested: 30,
      balanceDelta: 0,
      reservedDelta: 30,
      balanceAfter: 100,
      reservedAfter: 30,
      reservationId: "reservation-1",
    });
  });
}

async function balances(db: PGlite) {
  return (
    await db.query(`SELECT balance_points::text AS balance, reserved_points::text AS reserved,
      revision::text AS revision FROM loyalty_wallets WHERE member_id = 'member-1'`)
  ).rows[0];
}

describe("loyalty wallet migration", () => {
  it("does not enroll existing users or create historical balances", async () => {
    const db = await database();
    try {
      for (const table of [
        "loyalty_members",
        "loyalty_wallets",
        "loyalty_operations",
        "loyalty_reservations",
      ]) {
        assert.deepEqual((await db.query(`SELECT * FROM ${table}`)).rows, []);
      }
      await enroll(db);
      assert.deepEqual(await balances(db), {
        balance: "0",
        reserved: "0",
        revision: "0",
      });
      assert.deepEqual(
        (await db.query(`SELECT status, history_state FROM loyalty_members`))
          .rows,
        [{ status: "active", history_state: "pending" }],
      );
      await assert.rejects(
        db.exec(
          `INSERT INTO loyalty_members (id, user_id, terms_version) VALUES ('duplicate', 'user-1', 'v1')`,
        ),
        /unique constraint/,
      );
    } finally {
      await db.close();
    }
  });

  it("commits a credit, reserve and consume atomically despite intermediate mismatches", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await reserve(db);
      await transaction(db, async () => {
        await db.exec(
          `UPDATE loyalty_reservations SET status = 'consumed' WHERE id = 'reservation-1'`,
        );
        await writeOperation(db, {
          id: "consume-1",
          sequence: 3,
          kind: "consume",
          requested: 30,
          balanceDelta: -30,
          reservedDelta: -30,
          balanceAfter: 70,
          reservationId: "reservation-1",
        });
      });
      assert.deepEqual(await balances(db), {
        balance: "70",
        reserved: "0",
        revision: "3",
      });
    } finally {
      await db.close();
    }
  });

  it("releases reserved points and floors a reversal at zero with an auditable requested amount", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await reserve(db);
      await transaction(db, async () => {
        await db.exec(
          `UPDATE loyalty_reservations SET status = 'released' WHERE id = 'reservation-1'`,
        );
        await writeOperation(db, {
          id: "release-1",
          sequence: 3,
          kind: "release",
          requested: 30,
          balanceDelta: 0,
          reservedDelta: -30,
          balanceAfter: 100,
          reservationId: "reservation-1",
        });
      });
      await transaction(db, () =>
        writeOperation(db, {
          id: "reverse-1",
          sequence: 4,
          kind: "reversal",
          requested: 150,
          balanceDelta: -100,
          balanceAfter: 0,
        }),
      );
      await transaction(db, () =>
        writeOperation(db, {
          id: "reverse-2",
          sequence: 5,
          kind: "reversal",
          requested: 20,
          balanceDelta: 0,
          balanceAfter: 0,
        }),
      );
      assert.deepEqual(await balances(db), {
        balance: "0",
        reserved: "0",
        revision: "5",
      });
    } finally {
      await db.close();
    }
  });

  it("rejects wallet-only and ledger-only mutations at commit and rolls them back", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await assert.rejects(
        transaction(db, () =>
          db.exec(
            `UPDATE loyalty_wallets SET balance_points = 200 WHERE member_id = 'member-1'`,
          ),
        ),
        /does not match its ledger/,
      );
      await assert.rejects(
        transaction(db, () =>
          insertOperation(db, {
            id: "bad-credit",
            sequence: 2,
            kind: "credit",
            requested: 100,
            balanceDelta: 100,
            balanceAfter: 200,
          }),
        ),
        /does not match its ledger/,
      );
      assert.deepEqual(await balances(db), {
        balance: "100",
        reserved: "0",
        revision: "1",
      });
      assert.equal(
        (await db.query(`SELECT * FROM loyalty_operations`)).rows.length,
        1,
      );
    } finally {
      await db.close();
    }
  });

  it("rejects sequence gaps and forged intermediate snapshots even with matching final totals", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await assert.rejects(
        transaction(db, () =>
          writeOperation(db, {
            id: "gap",
            sequence: 3,
            kind: "credit",
            requested: 10,
            balanceDelta: 10,
            balanceAfter: 110,
          }),
        ),
        /does not match its ledger/,
      );
      await assert.rejects(
        transaction(db, async () => {
          await insertOperation(db, {
            id: "bad-middle",
            sequence: 2,
            kind: "credit",
            requested: 10,
            balanceDelta: 10,
            balanceAfter: 111,
          });
          await writeOperation(db, {
            id: "valid-final",
            sequence: 3,
            kind: "credit",
            requested: 10,
            balanceDelta: 10,
            balanceAfter: 120,
          });
        }),
        /do not match ledger sequence/,
      );
      assert.deepEqual(await balances(db), {
        balance: "100",
        reserved: "0",
        revision: "1",
      });
    } finally {
      await db.close();
    }
  });

  it("enforces safe integer bounds, operation equations and nonnegative available balance", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      for (const changes of [
        { requested: 0 },
        { sequence: 0 },
        {
          requested: "9007199254740992",
          balanceDelta: "9007199254740992",
          balanceAfter: "9007199254741092",
        },
        { balanceDelta: 9 },
        { reservedDelta: 1 },
        { balanceAfter: -1 },
        { reservedAfter: 111 },
        { kind: "reversal", balanceDelta: -11 },
        { kind: "reserve", balanceDelta: 0, reservedDelta: 10 },
        { kind: "consume", balanceDelta: -10, reservedDelta: -9 },
        { kind: "release", balanceDelta: 1, reservedDelta: -10 },
      ]) {
        await assert.rejects(
          transaction(db, () =>
            writeOperation(db, {
              id: "invalid",
              sequence: 2,
              kind: "credit",
              requested: 10,
              balanceDelta: 10,
              balanceAfter: 110,
              ...changes,
            }),
          ),
          /check constraint/,
        );
      }
      for (const statement of [
        `UPDATE loyalty_wallets SET balance_points = -1`,
        `UPDATE loyalty_wallets SET balance_points = 9007199254740992`,
        `UPDATE loyalty_wallets SET reserved_points = 101`,
        `UPDATE loyalty_wallets SET revision = -1`,
      ]) {
        await assert.rejects(db.exec(statement), /check constraint/);
      }
      assert.deepEqual(await balances(db), {
        balance: "100",
        reserved: "0",
        revision: "1",
      });
    } finally {
      await db.close();
    }
  });

  it("makes journal entries append-only and idempotency keys unique", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await assert.rejects(
        db.exec(`UPDATE loyalty_operations SET source_key = 'other'`),
        /append-only/,
      );
      await assert.rejects(
        db.exec(`DELETE FROM loyalty_operations`),
        /append-only/,
      );
      await assert.rejects(
        transaction(db, () =>
          insertOperation(db, {
            id: "duplicate",
            operationKey: "credit-1",
            sequence: 2,
            kind: "credit",
            requested: 10,
            balanceDelta: 10,
            balanceAfter: 110,
          }),
        ),
        /unique constraint/,
      );
    } finally {
      await db.close();
    }
  });

  it("prevents orphan reservations, status-only transitions and immutable field changes", async () => {
    const db = await database();
    try {
      await enroll(db);
      await credit(db);
      await assert.rejects(
        transaction(db, () =>
          db.exec(
            `INSERT INTO loyalty_reservations (id, member_id, order_id, points)
         VALUES ('orphan', 'member-1', 'order-1', 30)`,
          ),
        ),
        /status does not match its ledger/,
      );
      await reserve(db);
      await assert.rejects(
        db.exec(`UPDATE loyalty_reservations SET status = 'consumed'`),
        /status does not match its ledger/,
      );
      for (const change of [
        "points = 31",
        "order_id = 'order-2'",
        "id = 'other'",
      ]) {
        await assert.rejects(
          db.exec(`UPDATE loyalty_reservations SET ${change}`),
          /immutable/,
        );
      }
      await assert.rejects(
        db.exec(`DELETE FROM loyalty_reservations`),
        /cannot be deleted/,
      );
      await transaction(db, async () => {
        await db.exec(`UPDATE loyalty_reservations SET status = 'released'`);
        await writeOperation(db, {
          id: "release",
          sequence: 3,
          kind: "release",
          requested: 30,
          balanceDelta: 0,
          reservedDelta: -30,
          balanceAfter: 100,
          reservationId: "reservation-1",
        });
      });
      await assert.rejects(
        db.exec(`UPDATE loyalty_reservations SET status = 'reserved'`),
        /Invalid loyalty reservation transition/,
      );
      await assert.rejects(
        db.exec(`UPDATE loyalty_reservations SET status = 'consumed'`),
        /Invalid loyalty reservation transition/,
      );
      await db.exec(`UPDATE loyalty_reservations SET updated_at = now()`);
    } finally {
      await db.close();
    }
  });

  it("rejects reservation member/amount mismatch and duplicate consumption", async () => {
    const db = await database();
    try {
      await enroll(db);
      await enroll(db, "2");
      await credit(db);
      await reserve(db);
      await assert.rejects(
        transaction(db, async () => {
          await db.exec(`UPDATE loyalty_reservations SET status = 'consumed'`);
          await writeOperation(db, {
            id: "wrong-points",
            sequence: 3,
            kind: "consume",
            requested: 20,
            balanceDelta: -20,
            reservedDelta: -20,
            balanceAfter: 80,
            reservedAfter: 10,
            reservationId: "reservation-1",
          });
        }),
        /does not match its reservation/,
      );
      await assert.rejects(
        transaction(db, () => {
          return writeOperation(db, {
            id: "wrong-member",
            sequence: 1,
            kind: "reserve",
            requested: 30,
            balanceDelta: 0,
            reservedDelta: 30,
            balanceAfter: 0,
            reservedAfter: 30,
            memberId: "member-2",
            reservationId: "reservation-1",
          });
        }),
        /check constraint/,
      );
      await assert.rejects(
        transaction(db, async () => {
          await db.exec(`UPDATE loyalty_reservations SET status = 'consumed'`);
          await writeOperation(db, {
            id: "consume-a",
            sequence: 3,
            kind: "consume",
            requested: 30,
            balanceDelta: -30,
            reservedDelta: -30,
            balanceAfter: 70,
            reservationId: "reservation-1",
          });
          await writeOperation(db, {
            id: "consume-b",
            sequence: 4,
            kind: "consume",
            requested: 30,
            balanceDelta: -30,
            reservedDelta: -30,
            balanceAfter: 40,
            reservedAfter: -30,
            reservationId: "reservation-1",
          });
        }),
        /check constraint/,
      );
      assert.deepEqual(await balances(db), {
        balance: "100",
        reserved: "30",
        revision: "2",
      });
    } finally {
      await db.close();
    }
  });
});
