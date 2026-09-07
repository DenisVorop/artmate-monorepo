import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { HttpException } from "@nestjs/common";

import type { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type {
  OzonPickupEligibleSnapshot,
  OzonPickupIndexRepositoryPort,
} from "../src/ozon/ozon-pickup-index.repository";
import { OzonPickupIndexSyncService } from "../src/ozon/ozon-pickup-index-sync.service";

describe("OzonPickupIndexSyncService", () => {
  it("contains database failures before lease acquisition and during failure persistence", async () => {
    const readFailure = createService({
      getDatabaseNow: async () => {
        throw new Error("database unavailable");
      },
    });
    const writeFailure = createService(
      {
        tryCreateBuilding: async () => ({
          id: "building",
          startedAt: new Date(),
        }),
        markFailedIfOwned: async () => {
          throw new Error("database unavailable");
        },
      },
      {
        getDeliveryPointListForSync: async () => {
          throw new Error("upstream unavailable");
        },
      },
    );
    await withEnv("true", "real", async () => {
      await assert.doesNotReject(readFailure.syncIfDue());
      await assert.doesNotReject(writeFailure.syncIfDue());
    });
  });

  it("shutdown waits for in-flight info without scheduling more batches or publishing", async () => {
    let finishInfo!: () => void;
    let bothStarted!: () => void;
    const gate = new Promise<void>((resolve) => {
      finishInfo = resolve;
    });
    const started = new Promise<void>((resolve) => {
      bothStarted = resolve;
    });
    let infoCalls = 0;
    const events: string[] = [];
    const service = createService(
      {
        tryCreateBuilding: async () => ({
          id: "building",
          startedAt: new Date(),
        }),
        appendSnapshots: async () => {
          events.push("append");
        },
        markReady: async () => {
          events.push("ready");
        },
        publishReady: async () => (events.push("publish"), true),
        markFailedIfOwned: async () => (events.push("failed"), true),
      },
      {
        getDeliveryPointListForSync: async () =>
          Array.from({ length: 301 }, (_, i) => ({
            mapPointId: String(i),
            latitude: 55,
            longitude: 37,
          })),
        getDeliveryPointInfoForSync: async (batch: string[]) => {
          if (++infoCalls === 2) bothStarted();
          await gate;
          return batch.map((mapPointId) => ({
            mapPointId,
            eligible: false,
            reason: "disabled",
          }));
        },
      },
    );
    await withEnv("true", "real", async () => {
      const run = service.syncIfDue();
      await started;
      const stopped = service.onModuleDestroy();
      finishInfo();
      await Promise.all([run, stopped]);
    });
    assert.equal(infoCalls, 2);
    assert.deepEqual(events, ["failed"]);
  });

  it("does nothing unless sync is enabled in real mode", async () => {
    const events: string[] = [];
    const service = createService(
      { getDatabaseNow: async () => (events.push("clock"), new Date()) },
      {},
    );

    await withEnv("false", "real", () => service.syncIfDue());
    await withEnv("true", "mock", () => service.syncIfDue());

    assert.deepEqual(events, []);
  });

  it("coalesces local runs and skips a generation that is not due using DB time", async () => {
    let releaseClock!: () => void;
    const clockGate = new Promise<void>((resolve) => {
      releaseClock = resolve;
    });
    let clockCalls = 0;
    const now = new Date("2026-09-08T12:00:00.000Z");
    const service = createService({
      getDatabaseNow: async () => {
        clockCalls += 1;
        await clockGate;
        return now;
      },
      getLatestPublished: async () => ({
        id: "published",
        publishedAt: new Date("2026-09-08T11:00:00.000Z"),
        sourcePointCount: 10,
      }),
    });

    await withEnv("true", "real", async () => {
      const first = service.syncIfDue();
      const second = service.syncIfDue();
      releaseClock();
      await Promise.all([first, second]);
    });

    assert.equal(clockCalls, 1);
  });

  it("builds eligible snapshots with two info requests at most and publishes only after success", async () => {
    const events: string[] = [];
    const appended: OzonPickupEligibleSnapshot[] = [];
    let active = 0;
    let maxActive = 0;
    const ids = Array.from({ length: 201 }, (_unused, index) =>
      String(index + 1),
    );
    const service = createService(
      {
        appendSnapshots: async (_id, points) => {
          events.push("append");
          appended.push(...points);
        },
        getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
        getLatestPublished: async () => null,
        heartbeat: async () => (events.push("heartbeat"), true),
        markReady: async (_id, counters) => {
          events.push(
            `ready:${counters.source}:${counters.eligible}:${counters.excluded}`,
          );
        },
        publishReady: async () => (events.push("publish"), true),
        recoverStaleBuilder: async () => false,
        tryCreateBuilding: async () => ({
          id: "building",
          startedAt: new Date(),
        }),
      },
      {
        getDeliveryPointListForSync: async () =>
          ids.map((mapPointId, index) => ({
            mapPointId,
            latitude: 55 + index / 10_000,
            longitude: 37 + index / 10_000,
          })),
        getDeliveryPointInfoForSync: async (batch: readonly string[]) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await new Promise((resolve) => setTimeout(resolve, 2));
          active -= 1;
          return batch.map((mapPointId) =>
            mapPointId === "201"
              ? ({ mapPointId, eligible: false, reason: "disabled" } as const)
              : ({
                  mapPointId,
                  eligible: true,
                  city: "Москва",
                  region: "Москва",
                  title: `Ozon ${mapPointId}`,
                  address: `Москва, ${mapPointId}`,
                  workHours: "09:00-21:00",
                } as const),
          );
        },
      },
    );

    await withEnv("true", "real", () => service.syncIfDue());

    assert.equal(maxActive, 2);
    assert.equal(appended.length, 200);
    assert.equal(events.at(-2), "ready:201:200:1");
    assert.equal(events.at(-1), "publish");
  });

  it("retries transient info failures at most three times and never publishes an unsafe build", async () => {
    let attempts = 0;
    const events: string[] = [];
    const originalRandom = Math.random;
    Math.random = () => 0;
    const service = createService(
      {
        getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
        getLatestPublished: async () => null,
        heartbeat: async () => true,
        markFailedIfOwned: async () => (events.push("failed"), true),
        publishReady: async () => (events.push("publish"), true),
        recoverStaleBuilder: async () => false,
        tryCreateBuilding: async () => ({
          id: "building",
          startedAt: new Date(),
        }),
      },
      {
        getDeliveryPointListForSync: async () => [
          { mapPointId: "1", latitude: 55, longitude: 37 },
        ],
        getDeliveryPointInfoForSync: async () => {
          attempts += 1;
          throw new HttpException("temporary", 503);
        },
      },
    );

    try {
      await withEnv("true", "real", () => service.syncIfDue());
    } finally {
      Math.random = originalRandom;
    }

    assert.equal(attempts, 4);
    assert.deepEqual(events, ["failed"]);
  });

  it("rejects a zero or sharply reduced source list before point-info", async () => {
    let infoCalls = 0;
    const events: string[] = [];
    const service = createService(
      {
        getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
        getLatestPublished: async () => ({
          id: "published",
          publishedAt: new Date("2026-09-01T12:00:00.000Z"),
          sourcePointCount: 10,
        }),
        heartbeat: async () => true,
        markFailedIfOwned: async () => (events.push("failed"), true),
        recoverStaleBuilder: async () => false,
        tryCreateBuilding: async () => ({
          id: "building",
          startedAt: new Date(),
        }),
      },
      {
        getDeliveryPointListForSync: async () => [
          { mapPointId: "1", latitude: 55, longitude: 37 },
          { mapPointId: "2", latitude: 56, longitude: 38 },
          { mapPointId: "3", latitude: 57, longitude: 39 },
          { mapPointId: "4", latitude: 58, longitude: 40 },
        ],
        getDeliveryPointInfoForSync: async () => {
          infoCalls += 1;
          return [];
        },
      },
    );

    await withEnv("true", "real", () => service.syncIfDue());

    assert.equal(infoCalls, 0);
    assert.deepEqual(events, ["failed"]);
  });
});

function createService(
  repositoryOverrides: Partial<OzonPickupIndexRepositoryPort>,
  logisticsOverrides: object = {},
) {
  const repository: OzonPickupIndexRepositoryPort = {
    pruneExpiredGeneration: async () => 0,
    appendSnapshots: async () => undefined,
    getDatabaseNow: async () => new Date(),
    getLatestPublished: async () => null,
    heartbeat: async () => true,
    markFailedIfOwned: async () => true,
    markReady: async () => undefined,
    publishReady: async () => true,
    recoverStaleBuilder: async () => false,
    tryCreateBuilding: async () => null,
    ...repositoryOverrides,
  };

  return new OzonPickupIndexSyncService(
    repository,
    logisticsOverrides as OzonLogisticsService,
  );
}

async function withEnv<T>(
  enabled: string,
  mode: string,
  run: () => T | Promise<T>,
) {
  const previousEnabled = process.env.OZON_PICKUP_INDEX_SYNC_ENABLED;
  const previousMode = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_PICKUP_INDEX_SYNC_ENABLED = enabled;
  process.env.OZON_LOGISTICS_MODE = mode;

  try {
    return await run();
  } finally {
    if (previousEnabled === undefined)
      delete process.env.OZON_PICKUP_INDEX_SYNC_ENABLED;
    else process.env.OZON_PICKUP_INDEX_SYNC_ENABLED = previousEnabled;
    if (previousMode === undefined) delete process.env.OZON_LOGISTICS_MODE;
    else process.env.OZON_LOGISTICS_MODE = previousMode;
  }
}
