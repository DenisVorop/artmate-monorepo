import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";

import {
  OzonPickupIndexReadService,
  type OzonPickupIndexReadRepositoryPort,
} from "../src/ozon/ozon-pickup-index-read.service";

describe("OzonPickupIndexReadService", () => {
  it("handles blank and compatibility-expanded city queries before reading the database", async () => {
    const service = createService({
      getDatabaseNow: async () => {
        throw new Error("Must not read database");
      },
    });
    for (const query of ["", "  ", "\u00a0\u00a0", " а "]) {
      assert.deepEqual(
        await withMode("real", () => service.searchCities(query)),
        [],
      );
    }
    await assert.rejects(
      withMode("real", () => service.searchCities("ﬃ".repeat(60))),
      BadRequestException,
    );
  });

  it("searches normalized locality prefixes only in the latest usable published generation", async () => {
    const calls: unknown[] = [];
    const service = createService({
      findPublishedLocalities: async (generationId, prefix) => {
        calls.push([generationId, prefix]);
        return [
          {
            id: "locality-1",
            name: "Ёлки",
            region: "Тульская область",
            countryCode: "RU",
          },
        ];
      },
      getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
      getLatestPublished: async () => ({
        id: "published-2",
        publishedAt: new Date("2026-09-01T12:00:01.000Z"),
        sourcePointCount: 100,
      }),
    });

    const cities = await withMode("real", () => service.searchCities("  ЁЛ  "));

    assert.deepEqual(calls, [["published-2", "ел"]]);
    assert.equal(cities[0]?.region, "Тульская область");
  });

  it("returns the complete locality point list with fixed storefront pricing", async () => {
    const service = createService({
      findPublishedPickupPoints: async () => [
        {
          id: "point-1",
          title: "Ozon ПВЗ",
          address: "Москва, улица 1",
          workHours: "09:00-21:00",
          latitude: 55.7,
          longitude: 37.6,
        },
        {
          id: "point-2",
          title: "Ozon ПВЗ 2",
          address: "Москва, улица 2",
          workHours: "10:00-22:00",
          latitude: 55.8,
          longitude: 37.7,
        },
      ],
      getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
      getLatestPublished: async () => ({
        id: "published-2",
        publishedAt: new Date("2026-08-10T12:00:01.000Z"),
        sourcePointCount: 100,
      }),
    });

    const points = await withMode("real", () =>
      service.getPickupPoints("locality-1"),
    );

    assert.equal(points.length, 2);
    assert.equal(points[0]?.deliveryPrice, 100);
    assert.equal(points[1]?.minimumDeliveryPrice, 100);
  });

  it("returns an explicit 503 when no snapshot exists or DB-clock age reaches 30 days", async () => {
    for (const publishedAt of [null, new Date("2026-08-09T12:00:00.000Z")]) {
      let readCalls = 0;
      const service = createService({
        findPublishedLocalities: async () => {
          readCalls += 1;
          return [];
        },
        getDatabaseNow: async () => new Date("2026-09-08T12:00:00.000Z"),
        getLatestPublished: async () =>
          publishedAt
            ? { id: "expired", publishedAt, sourcePointCount: 100 }
            : null,
      });

      await assert.rejects(
        withMode("real", () => service.searchCities("мо")),
        ServiceUnavailableException,
      );
      assert.equal(readCalls, 0);
    }
  });

  it("provides deterministic mock localities and only eligible staffed points without DB reads", async () => {
    const repository = new Proxy(
      {},
      {
        get: () => () => {
          throw new Error("Mock read must not access the published index");
        },
      },
    ) as OzonPickupIndexReadRepositoryPort;
    const service = new OzonPickupIndexReadService(repository);

    const cities = await withMode("mock", () => service.searchCities("сан"));
    const first = cities[0];
    assert.deepEqual(cities, [
      {
        id: "mock:ru:spb",
        name: "Санкт-Петербург",
        region: "Санкт-Петербург",
        countryCode: "RU",
      },
    ]);

    const points = await withMode("mock", () =>
      service.getPickupPoints(first!.id),
    );
    assert.equal(points.length, 3);
    assert.ok(points.every((point) => point.id && point.deliveryPrice === 100));
  });
});

function createService(overrides: Partial<OzonPickupIndexReadRepositoryPort>) {
  const repository = {
    findPublishedLocalities: async () => [],
    findPublishedPickupPoints: async () => [],
    getDatabaseNow: async () => new Date(),
    getLatestPublished: async () => null,
    ...overrides,
  } as OzonPickupIndexReadRepositoryPort;

  return new OzonPickupIndexReadService(repository);
}

async function withMode<T>(mode: string, run: () => T | Promise<T>) {
  const previous = process.env.OZON_LOGISTICS_MODE;
  process.env.OZON_LOGISTICS_MODE = mode;

  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env.OZON_LOGISTICS_MODE;
    else process.env.OZON_LOGISTICS_MODE = previous;
  }
}
