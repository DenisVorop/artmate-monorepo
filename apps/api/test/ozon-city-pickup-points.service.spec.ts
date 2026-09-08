import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException, Logger } from "@nestjs/common";

import { OzonCityPickupPointsService } from "../src/delivery/ozon-city-pickup-points.service";
import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

const city = {
  code: 44,
  countryCode: "RU",
  latitude: 5,
  longitude: 5,
  name: "Москва",
  region: "Москва",
};
const boundary = {
  bbox: [0, 0, 10, 10] as const,
  coordinates: [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  ] as const,
  type: "MultiPolygon" as const,
};

describe("Ozon city pickup-point dataset", () => {
  it("batches every in-boundary ID by 100 and publishes only the complete dataset", async () => {
    await withRealMode(async () => {
      const cache = createCache();
      const batches: string[][] = [];
      const list = Array.from({ length: 205 }, (_, index) => ({
        mapPointId: `point-${index}`,
        latitude: 1,
        longitude: 1,
      }));
      const service = createService(cache, {
        getDeliveryPointInfoBatch: async (ids: string[]) => {
          batches.push(ids);
          return ids.map(pointInfo);
        },
        getDeliveryPointList: async () => list,
      });

      const points = await service.getPickupPoints(city);
      assert.deepEqual(
        batches.map((batch) => batch.length),
        [100, 100, 5],
      );
      assert.equal(points.length, 205);
      assert.equal(points[0]?.deliveryPrice, 100);
      assert.equal(
        (cache.entries.get("ozon:city:44")?.payload as unknown[]).length,
        205,
      );
      const published = cache.publications.find(
        (item) => item.key === "ozon:city:44",
      );
      assert.equal(published?.freshTtlMs, 7 * 24 * 60 * 60_000);
      assert.equal(published?.maxTtlMs, 30 * 24 * 60 * 60_000);
    });
  });

  it("publishes complete multi-batch data with empty Petersburg and Sochi schedules through the real parser", async () => {
    await withRealMode(async () => {
      const cache = createCache();
      const ids = [
        "2655484",
        ...Array.from({ length: 100 }, (_, index) => `point-${index}`),
        "2655565",
      ];
      const logistics = new OzonLogisticsService({
        requestSellerApi: async (path: string, body: unknown) => {
          if (path === "/v1/delivery/point/list") {
            return {
              points: ids.map((mapPointId) => ({
                coordinate: { lat: 1, long: 1 },
                map_point_id: mapPointId,
              })),
            };
          }

          const requestedIds = (body as { map_point_ids: string[] })
            .map_point_ids;
          return {
            points: requestedIds.map((mapPointId) =>
              createUpstreamPoint(mapPointId, {
                address:
                  mapPointId === "2655484"
                    ? "Санкт-Петербург, CDEK137"
                    : mapPointId === "2655565"
                      ? "Сочи, CDEK437"
                      : `Адрес ${mapPointId}`,
                workingHours:
                  mapPointId === "2655484" || mapPointId === "2655565"
                    ? []
                    : undefined,
              }),
            ),
          };
        },
      } as unknown as OzonOAuthService);
      const service = createService(cache, logistics);

      const points = await service.getPickupPoints(city);

      assert.equal(points.length, ids.length);
      assert.equal(
        points.find((point) => point.id === "2655484")?.workHours,
        "График работы уточняется",
      );
      assert.equal(
        points.find((point) => point.id === "2655565")?.workHours,
        "График работы уточняется",
      );
      assert.equal(
        (cache.entries.get("ozon:city:44")?.payload as unknown[]).length,
        ids.length,
      );
    });
  });

  it("waits for in-flight workers after a later batch fails and never publishes partial data", async () => {
    await withRealMode(async () => {
      const cache = createCache();
      const warnings: unknown[] = [];
      const originalWarn = Logger.prototype.warn;
      Logger.prototype.warn = function (message: unknown) {
        warnings.push(message);
      };
      let slowSettled = false;
      try {
        const service = createService(cache, {
          getDeliveryPointList: async () =>
            Array.from({ length: 205 }, (_, index) => ({
              mapPointId: `point-${index}`,
              latitude: 1,
              longitude: 1,
            })),
          getDeliveryPointInfoBatch: async (ids: string[]) => {
            if (ids[0] === "point-100")
              throw new Error("secret-marker-from-upstream");
            await delay(30);
            slowSettled = true;
            return ids.map(pointInfo);
          },
        });

        await assert.rejects(
          service.getPickupPoints(city),
          (error) =>
            error instanceof BadGatewayException &&
            /Не удалось загрузить пункты Ozon/u.test(error.message) &&
            !/secret-marker/u.test(error.message),
        );
        assert.equal(slowSettled, true);
        assert.equal(cache.entries.has("ozon:city:44"), false);
        assert.equal(cache.leases.size, 0);
        assert.deepEqual(warnings, [
          {
            batchIndex: 1,
            cityCode: 44,
            errorType: "error",
            stage: "point-info",
          },
        ]);
        assert.doesNotMatch(JSON.stringify(warnings), /secret-marker/u);
      } finally {
        Logger.prototype.warn = originalWarn;
      }
    });
  });

  it("serves a stale city snapshot while a failed refresh preserves it", async () => {
    await withRealMode(async () => {
      const cache = createCache();
      const oldPoints = [
        {
          id: "old",
          title: "Old",
          address: "Old address",
          workHours: "09:00-20:00",
          latitude: 1,
          longitude: 1,
          deliveryPrice: 100,
        },
      ];
      cache.entries.set("ozon:city:44", {
        payload: oldPoints,
        freshUntil: new Date(Date.now() - 1),
        expiresAt: new Date(Date.now() + 100_000),
      });
      cache.entries.set("ozon:point-list", {
        payload: [{ mapPointId: "stale-source", latitude: 1, longitude: 1 }],
        freshUntil: new Date(Date.now() - 1),
        expiresAt: new Date(Date.now() + 100_000),
      });
      let attempted = false;
      const service = createService(cache, {
        getDeliveryPointList: async () => {
          attempted = true;
          throw new Error("provider failed");
        },
        getDeliveryPointInfoBatch: async () => [],
      });

      assert.deepEqual(await service.getPickupPoints(city), oldPoints);
      for (let count = 0; count < 20 && !attempted; count += 1) await delay(5);
      assert.equal(attempted, true);
      assert.deepEqual(cache.entries.get("ozon:city:44")?.payload, oldPoints);
    });
  });

  it("singleflights concurrent cold requests and lets the waiter read atomic publication", async () => {
    await withRealMode(async () => {
      const cache = createCache();
      let listCalls = 0;
      let releaseInfo: (() => void) | undefined;
      const infoReady = new Promise<void>((resolve) => {
        releaseInfo = resolve;
      });
      let infoStarted: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        infoStarted = resolve;
      });
      const service = createService(cache, {
        getDeliveryPointList: async () => {
          listCalls += 1;
          return [{ mapPointId: "point-1", latitude: 1, longitude: 1 }];
        },
        getDeliveryPointInfoBatch: async () => {
          infoStarted?.();
          await infoReady;
          return [pointInfo("point-1")];
        },
      });

      const first = service.getPickupPoints(city);
      await started;
      const second = service.getPickupPoints(city);
      releaseInfo?.();
      const [firstPoints, secondPoints] = await Promise.all([first, second]);
      assert.deepEqual(secondPoints, firstPoints);
      assert.equal(listCalls, 1);
      assert.equal(
        cache.publications.filter((item) => item.key === "ozon:city:44").length,
        1,
      );
    });
  });
});

function createService(
  cache: ReturnType<typeof createCache>,
  logistics: object,
) {
  return new OzonCityPickupPointsService(
    cache as never,
    logistics as never,
    { resolve: async () => boundary } as never,
  );
}

function createCache() {
  type Entry = { payload: unknown; freshUntil: Date; expiresAt: Date };
  const entries = new Map<string, Entry>();
  const leases = new Map<string, string>();
  const publications: Array<{
    key: string;
    freshTtlMs: number;
    maxTtlMs: number;
  }> = [];
  return {
    entries,
    leases,
    publications,
    cleanup: async () => undefined,
    find: async (key: string) => entries.get(key) ?? null,
    tryAcquireLease: async (key: string, token: string) => {
      if (leases.has(key)) return false;
      leases.set(key, token);
      return true;
    },
    publish: async (
      key: string,
      token: string,
      payload: unknown,
      freshTtlMs: number,
      maxTtlMs: number,
    ) => {
      if (leases.get(key) !== token) return false;
      leases.delete(key);
      entries.set(key, {
        payload,
        freshUntil: new Date(Date.now() + freshTtlMs),
        expiresAt: new Date(Date.now() + maxTtlMs),
      });
      publications.push({ key, freshTtlMs, maxTtlMs });
      return true;
    },
    releaseLease: async (key: string, token: string) => {
      if (leases.get(key) === token) leases.delete(key);
    },
  };
}

function pointInfo(mapPointId: string) {
  return {
    mapPointId,
    eligible: true as const,
    title: "Ozon ПВЗ",
    address: `Адрес ${mapPointId}`,
    workHours: "09:00-21:00",
  };
}

function createUpstreamPoint(
  mapPointId: string,
  options: { address?: string; workingHours?: unknown[] } = {},
) {
  return {
    enabled: true,
    delivery_method: {
      address: options.address ?? `Адрес ${mapPointId}`,
      delivery_type: { id: 1002 },
      map_point_id: mapPointId,
      name: "Ozon ПВЗ",
      working_hours: options.workingHours ?? [
        {
          periods: [
            {
              min: { hours: 9, minutes: 0 },
              max: { hours: 21, minutes: 0 },
            },
          ],
        },
      ],
    },
  };
}

async function withRealMode(callback: () => Promise<void>) {
  const previous = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_LOGISTICS_MODE = "real";
  try {
    await callback();
  } finally {
    if (previous === undefined) delete process.env.OZON_LOGISTICS_MODE;
    else process.env.OZON_LOGISTICS_MODE = previous;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
