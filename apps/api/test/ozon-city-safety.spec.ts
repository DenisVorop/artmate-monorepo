import "reflect-metadata";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException } from "@nestjs/common";

import type { DeliveryCacheRecord } from "../src/delivery/delivery-cache.repository";
import { LocalityBoundaryException } from "../src/delivery/nominatim-locality.service";
import { OzonCityPickupPointsService } from "../src/delivery/ozon-city-pickup-points.service";
import type { OzonPickupListItem } from "../src/ozon/ozon-pickup.adapter";

const city = {
  code: 44,
  countryCode: "RU",
  latitude: 1,
  longitude: 1,
  name: "Тестовый",
  region: "Тестовая область",
};
const cityKey = "ozon:city:44";
const pointListKey = "ozon:point-list";
const builderKey = "ozon:city-builder";

describe("Ozon city independent safety regressions", () => {
  it("releases the point-list lease when asynchronous publication rejects", async () => {
    const harness = createHarness({
      publishError: new Error("SYNTHETIC_PRIVATE_DATABASE_DETAILS"),
    });

    await assert.rejects(
      withRealMode(() => harness.service.getPickupPoints(city)),
      (error) => {
        assert.ok(error instanceof BadGatewayException);
        assert.doesNotMatch(
          JSON.stringify(error.getResponse()),
          /SYNTHETIC_PRIVATE/,
        );
        return true;
      },
    );

    assert.ok(harness.released.includes(pointListKey));
    assert.ok(harness.released.includes(cityKey));
    assert.ok(harness.released.includes(builderKey));
    assert.equal(harness.leases.size, 0);
    assert.equal(harness.calls.info, 0);
  });

  it("keeps the previous city and point-list cache when the global list becomes empty", async () => {
    await assertUnsafeListPreservesCache([]);
  });

  it("keeps the previous cache when the global list loses more than half its points", async () => {
    await assertUnsafeListPreservesCache(makePoints(4));
  });

  it("does not mistake an exact 50 percent source decrease for an unsafe larger drop", async () => {
    const harness = createHarness({ points: makePoints(5) });
    harness.records.set(
      pointListKey,
      record(pointListKey, makePoints(10), true),
    );

    const points = await withRealMode(() =>
      harness.service.getPickupPoints(city),
    );

    assert.equal(points.length, 5);
    assert.equal(harness.calls.info, 1);
    assert.equal(
      (harness.records.get(pointListKey)?.payload as unknown[]).length,
      5,
    );
    assert.equal(
      (harness.records.get(cityKey)?.payload as unknown[]).length,
      5,
    );
  });

  it("does not request Ozon data when an exact boundary is unavailable", async () => {
    const harness = createHarness({
      boundaryError: new LocalityBoundaryException("missing"),
    });

    await assert.rejects(
      withRealMode(() => harness.service.getPickupPoints(city)),
      (error) => {
        assert.ok(error instanceof LocalityBoundaryException);
        assert.equal(
          (error.getResponse() as { code: string }).code,
          "DELIVERY_BOUNDARY_MISSING",
        );
        return true;
      },
    );

    assert.equal(harness.calls.list, 0);
    assert.equal(harness.calls.info, 0);
    assert.equal(harness.published.length, 0);
    assert.equal(harness.leases.size, 0);
    assert.equal(harness.released.includes(pointListKey), false);
  });

  it("settles in-flight batches before releasing the builder and hides raw provider errors", async () => {
    let finishSecond!: () => void;
    const secondGate = new Promise<void>((resolve) => {
      finishSecond = resolve;
    });
    let calls = 0;
    const harness = createHarness({
      points: makePoints(201),
      pointInfo: async (ids) => {
        calls += 1;
        if (calls === 1) {
          throw new BadGatewayException({
            message: "Synthetic provider error",
            body: { diagnostic: "SYNTHETIC_PRIVATE_PROVIDER_DETAILS" },
          });
        }
        await secondGate;
        return ids.map(pointInfo);
      },
    });

    await withRealMode(async () => {
      const request = harness.service.getPickupPoints(city);
      const rejected = assert.rejects(request, (error) => {
        assert.ok(error instanceof BadGatewayException);
        assert.doesNotMatch(
          JSON.stringify(error.getResponse()),
          /SYNTHETIC_PRIVATE_PROVIDER/,
        );
        return true;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(calls, 2);
      assert.equal(harness.released.includes(builderKey), false);
      assert.equal(harness.released.includes(cityKey), false);
      finishSecond();
      await rejected;
    });

    assert.equal(
      calls,
      2,
      "must not start the remaining third batch after failure",
    );
    assert.ok(harness.released.includes(builderKey));
    assert.equal(harness.records.has(cityKey), false);
  });
});

async function assertUnsafeListPreservesCache(points: OzonPickupListItem[]) {
  const harness = createHarness({ points });
  const previousPoints = [
    {
      id: "previous-point",
      title: "Сохранённый ПВЗ",
      address: "Тестовый, улица 1",
      workHours: "09:00-21:00",
      latitude: 1,
      longitude: 1,
      deliveryPrice: 100,
      minimumDeliveryPrice: 100,
    },
  ];
  const previousCity = record(cityKey, previousPoints, true);
  const previousList = record(pointListKey, makePoints(10), true);
  harness.records.set(cityKey, previousCity);
  harness.records.set(pointListKey, previousList);

  await withRealMode(async () => {
    assert.deepEqual(
      await harness.service.getPickupPoints(city),
      previousPoints,
    );
    await harness.builderFinished;
  });

  assert.equal(harness.records.get(cityKey), previousCity);
  assert.equal(harness.records.get(pointListKey), previousList);
  assert.equal(harness.published.length, 0);
  assert.equal(harness.calls.info, 0);
  assert.ok(harness.released.includes(pointListKey));
}

function createHarness(
  options: {
    boundaryError?: Error;
    points?: OzonPickupListItem[];
    publishError?: Error;
    pointInfo?: (
      ids: readonly string[],
    ) => Promise<ReturnType<typeof pointInfo>[]>;
  } = {},
) {
  const records = new Map<string, DeliveryCacheRecord>();
  const leases = new Map<string, string>();
  const released: string[] = [];
  const published: string[] = [];
  const calls = { list: 0, info: 0 };
  let finishBuilder!: () => void;
  const builderFinished = new Promise<void>((resolve) => {
    finishBuilder = resolve;
  });
  const cache = {
    cleanup: async () => undefined,
    find: async (key: string) => records.get(key) ?? null,
    tryAcquireLease: async (key: string, token: string) => {
      if (leases.has(key)) return false;
      leases.set(key, token);
      return true;
    },
    releaseLease: async (key: string, token: string) => {
      if (leases.get(key) === token) leases.delete(key);
      released.push(key);
      if (key === builderKey) finishBuilder();
    },
    publish: async (key: string, token: string, payload: unknown) => {
      if (options.publishError) throw options.publishError;
      if (leases.get(key) !== token) return false;
      records.set(key, record(key, payload));
      leases.delete(key);
      published.push(key);
      return true;
    },
  };
  const logistics = {
    getDeliveryPointList: async () => {
      calls.list += 1;
      return options.points ?? makePoints(1);
    },
    getDeliveryPointInfoBatch: async (ids: readonly string[]) => {
      calls.info += 1;
      return options.pointInfo ? options.pointInfo(ids) : ids.map(pointInfo);
    },
  };
  const nominatim = {
    resolve: async () => {
      if (options.boundaryError) throw options.boundaryError;
      return {
        type: "MultiPolygon",
        bbox: [0, 0, 2, 2],
        coordinates: [
          [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 2],
              [0, 0],
            ],
          ],
        ],
      };
    },
  };

  return {
    builderFinished,
    calls,
    leases,
    published,
    records,
    released,
    service: new OzonCityPickupPointsService(
      cache as never,
      logistics as never,
      nominatim as never,
    ),
  };
}

function makePoints(count: number): OzonPickupListItem[] {
  return Array.from({ length: count }, (_unused, index) => ({
    mapPointId: String(index + 1),
    latitude: 1,
    longitude: 1,
  }));
}

function pointInfo(mapPointId: string) {
  return {
    mapPointId,
    eligible: true as const,
    title: `ПВЗ ${mapPointId}`,
    address: `Тестовый, улица ${mapPointId}`,
    workHours: "09:00-21:00",
  };
}

function record(
  key: string,
  payload: unknown,
  stale = false,
): DeliveryCacheRecord {
  return {
    key,
    payload,
    byteSize: Buffer.byteLength(JSON.stringify(payload)),
    freshUntil: new Date(Date.now() + (stale ? -1 : 1) * 86_400_000),
    expiresAt: new Date(Date.now() + 20 * 86_400_000),
    refreshedAt: new Date(Date.now() - (stale ? 8 : 0) * 86_400_000),
    leaseUntil: null,
  };
}

async function withRealMode<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_LOGISTICS_MODE = "real";
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.OZON_LOGISTICS_MODE;
    else process.env.OZON_LOGISTICS_MODE = previous;
  }
}
