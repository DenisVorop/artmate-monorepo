import "reflect-metadata";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { after, before, describe, it } from "node:test";

import { PGlite, type Transaction } from "@electric-sql/pglite";

import { OrderActivationService } from "../src/auth/order-activation.service";
import {
  AuthRecoveryThrottleScope,
  OrderCheckoutThrottleScope,
  type Prisma,
} from "../src/generated/prisma/client";
import { CheckoutThrottleService } from "../src/orders/checkout-throttle.service";

type ThrottleSubject = {
  hash: string;
  maxRequests: number;
  scope: string;
};

type IncrementThrottle = (
  tx: Prisma.TransactionClient,
  subject: ThrottleSubject,
) => Promise<Date | undefined>;

type ThrottleBucket = {
  id: string;
  requestCount: number;
  windowStartedAt: Date;
  lastRequestAt: Date;
  blockedUntil: Date | null;
};

type ThrottleConfig = {
  enumName: string;
  enumLabels: Record<string, string>;
  increment: IncrementThrottle;
  modelName: string;
  table: string;
};

const checkoutConfig: ThrottleConfig = {
  enumName: "order_checkout_throttle_scope",
  enumLabels: {
    [OrderCheckoutThrottleScope.CART]: "cart",
    [OrderCheckoutThrottleScope.IP]: "ip",
  },
  increment: (
    CheckoutThrottleService.prototype as unknown as {
      incrementSubject: IncrementThrottle;
    }
  ).incrementSubject,
  modelName: "orderCheckoutThrottle",
  table: "order_checkout_throttles",
};

const recoveryConfig: ThrottleConfig = {
  enumName: "auth_recovery_throttle_scope",
  enumLabels: {
    [AuthRecoveryThrottleScope.EMAIL]: "email",
    [AuthRecoveryThrottleScope.IP]: "ip",
  },
  increment: (
    OrderActivationService.prototype as unknown as {
      incrementRecoveryThrottle: IncrementThrottle;
    }
  ).incrementRecoveryThrottle,
  modelName: "authRecoveryThrottle",
  table: "auth_recovery_throttles",
};

describe("throttle SQL against PostgreSQL enum mappings", () => {
  let db: PGlite;

  before(async () => {
    db = new PGlite();
    await db.exec("SET TIME ZONE 'UTC'");
    const migration = await readFile(
      resolve(
        __dirname,
        "../prisma/migrations/20260905120000_add_guest_checkout_activation_outbox/migration.sql",
      ),
      "utf8",
    );
    for (const config of [checkoutConfig, recoveryConfig]) {
      const schema = migration.match(
        new RegExp(
          `CREATE TYPE "${config.enumName}"[\\s\\S]*?CREATE INDEX "${config.table}_blocked_until_idx"[^;]*;`,
        ),
      )?.[0];
      assert.ok(schema, `Missing migration schema for ${config.table}`);
      await db.exec(schema);
    }
  });

  after(async () => db?.close());

  const cases = [
    {
      config: checkoutConfig,
      scope: OrderCheckoutThrottleScope.CART,
      limit: 5,
    },
    { config: checkoutConfig, scope: OrderCheckoutThrottleScope.IP, limit: 5 },
    {
      config: recoveryConfig,
      scope: AuthRecoveryThrottleScope.EMAIL,
      limit: 5,
    },
    { config: recoveryConfig, scope: AuthRecoveryThrottleScope.IP, limit: 20 },
  ];

  for (const { config, scope, limit } of cases) {
    it(`${config.modelName} ${scope} persists, locks, blocks, and resets its bucket`, async () => {
      const fixture = createThrottleFixture(db, config, {
        hash: "a".repeat(64),
        maxRequests: limit,
        scope,
      });

      assert.equal(await fixture.increment(), undefined);
      const first = await fixture.read();
      assert.equal(first.requestCount, 1);
      assert.equal(first.blockedUntil, null);

      for (let count = 2; count <= limit; count += 1) {
        await fixture.elapseCooldown();
        assert.equal(await fixture.increment(), undefined);
        const bucket = await fixture.read();
        assert.equal(bucket.id, first.id);
        assert.equal(bucket.requestCount, count);
      }

      await fixture.elapseCooldown();
      const blockedUntil = await fixture.increment();
      assert.ok(blockedUntil instanceof Date && blockedUntil > new Date());
      const blocked = await fixture.read();
      assert.equal(blocked.requestCount, limit + 1);
      assert.deepEqual(blocked.blockedUntil, blockedUntil);

      assert.deepEqual(await fixture.increment(), blockedUntil);
      assert.deepEqual(await fixture.read(), blocked);

      await fixture.expireWindow();
      assert.equal(await fixture.increment(), undefined);
      const reset = await fixture.read();
      assert.equal(reset.id, first.id);
      assert.equal(reset.requestCount, 1);
      assert.equal(reset.blockedUntil, null);
      assert.equal(fixture.lockCount(), limit + 3);
    });
  }

  it("persists the email resend cooldown and preserves an already blocked bucket", async () => {
    const fixture = createThrottleFixture(db, recoveryConfig, {
      hash: "b".repeat(64),
      maxRequests: 5,
      scope: AuthRecoveryThrottleScope.EMAIL,
    });
    assert.equal(await fixture.increment(), undefined);
    const first = await fixture.read();
    const blockedUntil = await fixture.increment();
    assert.equal(
      blockedUntil?.getTime(),
      first.lastRequestAt.getTime() + 60_000,
    );
    const blocked = await fixture.read();
    assert.equal(blocked.requestCount, 2);
    assert.deepEqual(await fixture.increment(), blockedUntil);
    assert.deepEqual(await fixture.read(), blocked);
    assert.equal(fixture.lockCount(), 3);
  });
});

function createThrottleFixture(
  db: PGlite,
  config: ThrottleConfig,
  subject: ThrottleSubject,
) {
  let locks = 0;
  // Prisma reads timestamp fields as UTC; PGlite otherwise uses the host timezone.
  const columns = `"id", "request_count" AS "requestCount",
    "window_started_at" AT TIME ZONE 'UTC' AS "windowStartedAt",
    "last_request_at" AT TIME ZONE 'UTC' AS "lastRequestAt",
    "blocked_until" AT TIME ZONE 'UTC' AS "blockedUntil"`;
  const databaseScope = (scope: string) => {
    const label = config.enumLabels[scope];
    assert.ok(label, `Unexpected Prisma enum value: ${scope}`);
    return label;
  };
  const read = async (connection: Pick<Transaction, "query"> = db) => {
    const result = await connection.query<ThrottleBucket>(
      `SELECT ${columns} FROM "${config.table}"
       WHERE "scope" = $1::"${config.enumName}" AND "subject_hash" = $2`,
      [databaseScope(subject.scope), subject.hash],
    );
    assert.equal(result.rows.length, 1);
    return result.rows[0]!;
  };

  return {
    increment: () =>
      db.transaction(async (connection) => {
        const model = {
          upsert: async ({
            create,
          }: {
            create: Pick<ThrottleSubject, "scope"> &
              Omit<ThrottleBucket, "id" | "blockedUntil"> & {
                subjectHash: string;
              };
          }) => {
            // Only ORM operations map Prisma enum names to database labels.
            const result = await connection.query<{ id: string }>(
              `INSERT INTO "${config.table}"
             ("id", "scope", "subject_hash", "request_count", "window_started_at", "last_request_at")
             VALUES ($1, $2::"${config.enumName}", $3, $4, $5, $6)
             ON CONFLICT ("scope", "subject_hash") DO UPDATE
             SET "id" = "${config.table}"."id" RETURNING "id"`,
              [
                randomUUID(),
                databaseScope(create.scope),
                create.subjectHash,
                create.requestCount,
                create.windowStartedAt,
                create.lastRequestAt,
              ],
            );
            return result.rows[0];
          },
          findUnique: () => read(connection),
          update: async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Omit<ThrottleBucket, "id">;
          }) => {
            await connection.query(
              `UPDATE "${config.table}" SET "request_count" = $2,
             "window_started_at" = $3, "last_request_at" = $4, "blocked_until" = $5
             WHERE "id" = $1`,
              [
                where.id,
                data.requestCount,
                data.windowStartedAt,
                data.lastRequestAt,
                data.blockedUntil,
              ],
            );
            return read(connection);
          },
        };
        const tx = {
          [config.modelName]: model,
          $queryRaw: async (statement: Prisma.Sql) => {
            // Execute the service's unmodified SQL and bound parameters.
            const result = await connection.query<{ id: string }>(
              statement.text,
              statement.values,
            );
            assert.match(statement.text, /FOR UPDATE/);
            assert.deepEqual(result.rows, [
              { id: (await read(connection)).id },
            ]);
            locks += 1;
            return result.rows;
          },
        } as unknown as Prisma.TransactionClient;
        return config.increment(tx, subject);
      }),
    read: () => read(),
    lockCount: () => locks,
    elapseCooldown: () =>
      db.query(
        `UPDATE "${config.table}" SET "last_request_at" = CURRENT_TIMESTAMP - INTERVAL '2 minutes'
       WHERE "scope" = $1::"${config.enumName}" AND "subject_hash" = $2`,
        [databaseScope(subject.scope), subject.hash],
      ),
    expireWindow: () =>
      db.query(
        `UPDATE "${config.table}" SET "window_started_at" = CURRENT_TIMESTAMP - INTERVAL '2 hours',
       "last_request_at" = CURRENT_TIMESTAMP - INTERVAL '2 hours',
       "blocked_until" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
       WHERE "scope" = $1::"${config.enumName}" AND "subject_hash" = $2`,
        [databaseScope(subject.scope), subject.hash],
      ),
  };
}
