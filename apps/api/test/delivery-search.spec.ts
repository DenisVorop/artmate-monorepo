import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadGatewayException } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";

import * as deliveryConstants from "../src/delivery/delivery.constants";
import { DeliveryController } from "../src/delivery/delivery.controller";
import { DeliveryProxyThrottleService } from "../src/delivery/delivery-proxy-throttle.service";
import { DeliveryService } from "../src/delivery/delivery.service";
import { CdekCityDetailsDTO, GetCdekCityQueryDTO } from "../src/delivery/dto";
import type { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import { ProviderResponseCacheService } from "../src/delivery/provider-response-cache.service";
import { OrdersController } from "../src/orders/orders.controller";
import { OzonController } from "../src/ozon/ozon.controller";
import type { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";

const providerResponseCacheMaxEntries = (
  deliveryConstants as Record<string, unknown>
).providerResponseCacheMaxEntries as number;
const { ozonProxySessionMaxRequests } = deliveryConstants;
type StorefrontIdentityTuple = readonly [
  string | undefined,
  string | undefined,
  string | undefined,
  string | undefined,
];

describe("delivery provider search", () => {
  it("deduplicates repeated confirmed provider calls", async () => {
    let citySearches = 0;
    const service = createService({
      searchCities: async () => {
        citySearches += 1;
        return [{ code: 44, countryCode: "RU", name: "Москва" }];
      },
    });

    const first = await service.searchCdekCities(" Москва ", "RU");
    const second = await service.searchCdekCities("Москва", "RU");

    assert.deepEqual(second, first);
    assert.equal(citySearches, 1);
  });

  it("keeps suggestion failures explicit while pickup-point failures stay neutral", async () => {
    const providerFailure = async () => {
      throw new Error("provider unavailable");
    };
    const service = createService({
      getPickupPoints: providerFailure,
      searchCities: providerFailure,
    });

    await assert.rejects(
      service.searchCdekCities("Москва", "RU"),
      BadGatewayException,
    );
    assert.deepEqual(await service.getCdekPickupPoints(44), []);
  });

  it("caches city details by exact code and does not cache errors", async () => {
    let calls = 0;
    const service = createService({
      getCity: async (cityCode: number) => {
        calls += 1;
        if (calls === 1) throw new Error("temporary failure");
        return {
          code: cityCode,
          countryCode: "RU",
          latitude: 55.75,
          longitude: 37.61,
          name: "Москва",
          region: "Москва",
        };
      },
    });

    await assert.rejects(service.getCdekCity(44), BadGatewayException);
    const city = await service.getCdekCity(44);
    assert.strictEqual(await service.getCdekCity(44), city);
    assert.equal(calls, 2);
  });
});

describe("provider response cache", () => {
  it("is bounded and evicts the oldest response", async () => {
    const modulePath = "../src/delivery/provider-response-cache.service";
    const { ProviderResponseCacheService } = (await import(modulePath)) as {
      ProviderResponseCacheService: new () => {
        getOrSet<T>(
          key: string,
          ttlMs: number,
          load: () => Promise<T>,
        ): Promise<T>;
      };
    };
    const cache = new ProviderResponseCacheService();

    for (let index = 0; index < providerResponseCacheMaxEntries; index += 1) {
      await cache.getOrSet(`key-${index}`, 60_000, async () => index);
    }

    await cache.getOrSet("overflow", 60_000, async () => "overflow");
    let reloads = 0;
    await cache.getOrSet("key-0", 60_000, async () => {
      reloads += 1;
      return 0;
    });

    assert.equal(reloads, 1);
  });

  it("does not cache rejected provider calls", async () => {
    const modulePath = "../src/delivery/provider-response-cache.service";
    const { ProviderResponseCacheService } = (await import(modulePath)) as {
      ProviderResponseCacheService: new () => {
        getOrSet<T>(
          key: string,
          ttlMs: number,
          load: () => Promise<T>,
        ): Promise<T>;
      };
    };
    const cache = new ProviderResponseCacheService();
    let calls = 0;

    await assert.rejects(
      cache.getOrSet("retryable", 60_000, async () => {
        calls += 1;
        throw new Error("temporary failure");
      }),
    );
    const recovered = await cache.getOrSet("retryable", 60_000, async () => {
      calls += 1;
      return "ok";
    });

    assert.equal(recovered, "ok");
    assert.equal(calls, 2);
  });
});

describe("delivery provider throttle", () => {
  it("rejects a storefront session above its bounded request limit", () => {
    const throttle = new DeliveryProxyThrottleService();
    const identity = { cookieHeader: "cart_id=delivery-search" };

    for (let index = 0; index < ozonProxySessionMaxRequests; index += 1) {
      throttle.assertAllowed(identity);
    }

    assert.throws(() => throttle.assertAllowed(identity));
  });

  it("throttles confirmed CDEK routes before provider delegation", async () => {
    const events: string[] = [];
    const controller = new DeliveryController(
      {
        getCdekPickupPoints: async () => {
          events.push("pickup-points");
          return [];
        },
        getCdekCity: async () => {
          events.push("city");
          return {};
        },
        searchCdekCities: async () => {
          events.push("cities");
          return [];
        },
      } as unknown as DeliveryService,
      {
        assertAllowed: () => events.push("throttle"),
      } as unknown as DeliveryProxyThrottleService,
    );
    const identity = [
      "cart_id=delivery-search",
      "203.0.113.10",
      undefined,
      "127.0.0.1",
    ] as const;
    const throttledController = controller as DeliveryController & {
      getCdekPickupPoints(
        query: { cityCode: number },
        ...identity: StorefrontIdentityTuple
      ): Promise<unknown>;
      getCdekCity(
        query: { cityCode: number },
        ...identity: StorefrontIdentityTuple
      ): Promise<unknown>;
      searchCdekCities(
        query: { countryCode?: string; query: string },
        ...identity: StorefrontIdentityTuple
      ): Promise<unknown>;
    };

    await throttledController.searchCdekCities(
      { countryCode: "RU", query: "Москва" },
      ...identity,
    );
    await throttledController.getCdekPickupPoints(
      { cityCode: 44 },
      ...identity,
    );
    await throttledController.getCdekCity({ cityCode: 44 }, ...identity);

    assert.deepEqual(events, [
      "throttle",
      "cities",
      "throttle",
      "pickup-points",
      "throttle",
      "city",
    ]);
  });

  it("declares the city route and validates its query and response contracts", () => {
    assert.equal(
      Reflect.getMetadata(
        PATH_METADATA,
        DeliveryController.prototype.getCdekCity,
      ),
      "cdek/city",
    );

    for (const cityCode of [undefined, 0, -1, 1.5, "not-a-number"]) {
      assert.notEqual(
        validateSync(plainToInstance(GetCdekCityQueryDTO, { cityCode })).length,
        0,
      );
    }
    assert.deepEqual(
      validateSync(plainToInstance(GetCdekCityQueryDTO, { cityCode: "44" })),
      [],
    );

    const validCity = {
      code: 44,
      countryCode: "RU",
      latitude: 0,
      longitude: 180,
      name: "Москва",
      region: "Москва",
    };
    assert.deepEqual(
      validateSync(plainToInstance(CdekCityDetailsDTO, validCity)),
      [],
    );
    assert.notEqual(
      validateSync(
        plainToInstance(CdekCityDetailsDTO, { ...validCity, latitude: 91 }),
      ).length,
      0,
    );
  });

  it("returns a provider-neutral throttle error", () => {
    const throttle = new DeliveryProxyThrottleService();
    const identity = { cookieHeader: "cart_id=delivery-search" };

    for (let index = 0; index < ozonProxySessionMaxRequests; index += 1) {
      throttle.assertAllowed(identity);
    }

    assert.throws(
      () => throttle.assertAllowed(identity),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.doesNotMatch(error.message, /ozon|cdek/i);
        return true;
      },
    );
  });
});

describe("Ozon storefront delivery boundary", () => {
  it("exposes Ozon discovery only through bounded delivery routes", () => {
    assert.equal("getOzonDeliveryMap" in DeliveryController.prototype, false);
    assert.equal(
      "getOzonDeliveryPoints" in DeliveryController.prototype,
      false,
    );

    for (const method of [
      "getDeliveryMap",
      "getDeliveryPointInfo",
      "getPickupPoints",
    ]) {
      assert.equal(
        method in OzonController.prototype,
        false,
        `${method} must not bypass the delivery cache and throttle`,
      );
    }

    assert.equal(
      "getPickupPoints" in OrdersController.prototype,
      false,
      "legacy order pickup points must not bypass delivery boundaries",
    );
  });
});

function createService(cdek: object = {}, ozonLogistics: object = {}) {
  return new DeliveryService(
    cdek as CdekDeliveryProvider,
    ozonLogistics as OzonLogisticsService,
    new ProviderResponseCacheService(),
    {} as never,
  );
}
