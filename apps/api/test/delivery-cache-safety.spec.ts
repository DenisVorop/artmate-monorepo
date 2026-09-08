import "reflect-metadata";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import {
  DeliveryCacheRepository,
  NominatimGateBusyError,
} from "../src/delivery/delivery-cache.repository";

describe("Delivery cache independent safety regressions", () => {
  it("accepts a realistic global point list above 5 MiB but keeps other entries bounded", async () => {
    const points = Array.from({ length: 94_000 }, (_unused, index) => ({
      mapPointId: String(1_000_000_000_000 + index),
      latitude: 55.1234567,
      longitude: 37.1234567,
    }));
    const byteSize = Buffer.byteLength(JSON.stringify(points));
    assert.ok(byteSize > 5 * 1024 * 1024 && byteSize < 32 * 1024 * 1024);
    const writes: unknown[] = [];
    const repository = new DeliveryCacheRepository({
      deliveryCacheEntry: {
        updateMany: async (args: unknown) => {
          writes.push(args);
          return { count: 1 };
        },
      },
    } as never);

    assert.equal(
      await repository.publish("ozon:point-list", "token", points, 1000, 2000),
      true,
    );
    await assert.rejects(
      repository.publish("boundary:cdek:44", "token", points, 1000, 2000),
      /Delivery cache payload is too large/,
    );
    await assert.rejects(
      repository.publish(
        "ozon:point-list",
        "token",
        { payload: "x".repeat(32 * 1024 * 1024) },
        1000,
        2000,
      ),
      /Delivery cache payload is too large/,
    );
    assert.equal(writes.length, 1);
  });

  it("fences publication by the exact lease token", async () => {
    let where: unknown;
    const repository = new DeliveryCacheRepository({
      deliveryCacheEntry: {
        updateMany: async (args: { where: unknown }) => {
          where = args.where;
          return { count: 0 };
        },
      },
    } as never);

    assert.equal(
      await repository.publish(
        "ozon:city:44",
        "00000000-0000-4000-8000-000000000001",
        [],
        1000,
        2000,
      ),
      false,
    );
    assert.deepEqual(where, {
      key: "ozon:city:44",
      leaseToken: "00000000-0000-4000-8000-000000000001",
    });
  });

  it("enforces the boundary entry budget and preserves actively leased entries", async () => {
    const { db, repository } = await createCacheDatabase();
    try {
      await db.exec(`
        INSERT INTO delivery_cache_entries
          (key, payload, byte_size, refreshed_at, fresh_until, expires_at)
        SELECT 'boundary:cdek:' || n, '{}'::jsonb, 2,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '7 days',
          CURRENT_TIMESTAMP + INTERVAL '30 days'
        FROM generate_series(1, 300) AS n;
        INSERT INTO delivery_cache_entries
          (key, lease_token, lease_until)
        VALUES ('boundary:cdek:active', '00000000-0000-4000-8000-000000000001',
          CURRENT_TIMESTAMP + INTERVAL '5 minutes');
      `);

      for (let pass = 0; pass < 3; pass += 1) await repository.cleanup();

      const count = await db.query<{ count: number }>(`
        SELECT count(*)::int AS count FROM delivery_cache_entries
        WHERE lease_token IS NULL
      `);
      assert.equal(count.rows[0]?.count, 250);
      const active = await db.query<{ key: string }>(`
        SELECT key FROM delivery_cache_entries WHERE key = 'boundary:cdek:active'
      `);
      assert.equal(active.rows.length, 1);
    } finally {
      await db.close();
    }
  });

  it("recovers crashed leases and removes abandoned empty cache records", async () => {
    const { db, repository } = await createCacheDatabase();
    try {
      await db.exec(`
        INSERT INTO delivery_cache_entries (key, updated_at)
        VALUES ('boundary:cdek:empty', CURRENT_TIMESTAMP - INTERVAL '11 minutes');
        INSERT INTO delivery_cache_entries
          (key, lease_token, lease_until, updated_at)
        VALUES ('boundary:cdek:crashed', '00000000-0000-4000-8000-000000000001',
          CURRENT_TIMESTAMP - INTERVAL '1 minute', CURRENT_TIMESTAMP - INTERVAL '11 minutes');
      `);

      await repository.cleanup();

      const remaining = await db.query<{ key: string; lease: string | null }>(`
        SELECT key, lease_token::text AS lease FROM delivery_cache_entries ORDER BY key
      `);
      assert.deepEqual(remaining.rows, [
        { key: "boundary:cdek:crashed", lease: null },
      ]);
      await db.exec(`
        UPDATE delivery_cache_entries
        SET updated_at = CURRENT_TIMESTAMP - INTERVAL '11 minutes'
        WHERE key = 'boundary:cdek:crashed'
      `);
      await repository.cleanup();
      assert.equal(
        (await db.query("SELECT key FROM delivery_cache_entries")).rows.length,
        0,
      );
    } finally {
      await db.close();
    }
  });

  it("holds the distributed gate through the request and spaces the next request after completion", async () => {
    const sharedGate = { locked: false, nextAllowedAt: 0 };
    const firstRepository = createGateRepository(false, sharedGate);
    const secondRepository = createGateRepository(false, sharedGate);
    let active = 0;
    let maxActive = 0;
    let firstFinishedAt = 0;
    let secondStartedAt = 0;
    const first = firstRepository.withNominatimGate(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(30);
      firstFinishedAt = Date.now();
      active -= 1;
      return "first";
    }, 5000);
    await delay(10);
    const second = secondRepository.withNominatimGate(async () => {
      secondStartedAt = Date.now();
      active += 1;
      maxActive = Math.max(maxActive, active);
      active -= 1;
      return "second";
    }, 5000);

    assert.deepEqual(await Promise.all([first, second]), ["first", "second"]);
    assert.equal(maxActive, 1);
    assert.ok(secondStartedAt - firstFinishedAt >= 1000);
  });

  it("commits a cooldown even when the upstream request fails", async () => {
    const repository = createGateRepository();
    const error = new Error("Synthetic upstream failure");
    let failedAt = 0;
    await assert.rejects(
      repository.withNominatimGate(async () => {
        failedAt = Date.now();
        throw error;
      }, 5000),
      (caught) => caught === error,
    );
    const nextStartedAt = await repository.withNominatimGate(
      async () => Date.now(),
      5000,
    );
    assert.ok(nextStartedAt - failedAt >= 1000);
  });

  it("does not call upstream if another request keeps the gate busy", async () => {
    const repository = createGateRepository(true);
    let requests = 0;
    await assert.rejects(
      repository.withNominatimGate(async () => {
        requests += 1;
      }, 1),
      NominatimGateBusyError,
    );
    assert.equal(requests, 0);
  });
});

async function createCacheDatabase() {
  const db = new PGlite();
  const migration = await readFile(
    resolve(
      __dirname,
      "../prisma/migrations/20260908120000_replace_ozon_pickup_index_with_delivery_cache/migration.sql",
    ),
    "utf8",
  );
  await db.exec(migration);
  const repository = new DeliveryCacheRepository({
    $executeRaw: async (statement: { text: string; values: unknown[] }) => {
      const result = await db.query(statement.text, statement.values);
      return result.affectedRows ?? 0;
    },
  } as never);
  return { db, repository };
}

function createGateRepository(
  alwaysLocked = false,
  state = { locked: alwaysLocked, nextAllowedAt: 0 },
) {
  if (alwaysLocked) state.locked = true;
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
      let ownsLock = false;
      try {
        return await callback({
          $queryRaw: async (statement: { text: string }) => {
            if (statement.text.includes("pg_try_advisory_xact_lock")) {
              if (state.locked) return [{ acquired: false }];
              state.locked = true;
              ownsLock = true;
              return [{ acquired: true }];
            }
            return [
              { nextAllowedAt: new Date(state.nextAllowedAt), now: new Date() },
            ];
          },
          $executeRaw: async (statement: { text: string }) => {
            if (statement.text.includes('UPDATE "nominatim_rate_limits"')) {
              state.nextAllowedAt = Date.now() + 1000;
            }
            return 1;
          },
        });
      } finally {
        if (ownsLock) state.locked = false;
      }
    },
  };
  return new DeliveryCacheRepository(prisma as never);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
