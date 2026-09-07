import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BadRequestException } from "@nestjs/common";

import { DeliveryService } from "../src/delivery/delivery.service";
import type { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import { ProviderResponseCacheService } from "../src/delivery/provider-response-cache.service";
import type {
  DeliveryCartItem,
  DeliveryQuote,
  DeliverySelection,
} from "../src/delivery/providers/delivery-provider.interface";
import type { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";

describe("DeliveryService", () => {
  it("uses the fixed Ozon price and point-info details for delivery calculation", async () => {
    let requestedPointId: string | undefined;
    const ozonLogistics = {
      getPickupPoint: async (pickupPointId: string) => {
        requestedPointId = pickupPointId;

        return {
          id: pickupPointId,
          title: "Ozon ПВЗ",
          address: "Москва, Тверская, 1",
          workHours: "09:00-21:00",
          latitude: 55.76,
          longitude: 37.61,
        };
      },
    };
    const service = createDeliveryService({}, ozonLogistics);

    const delivery = await service.calculatePickupPointDelivery(
      {
        provider: "ozon",
        pickupPointAddress: "Недоверенный адрес клиента",
        pickupPointId: "11",
      },
      [],
    );

    assert.equal(delivery.provider, "ozon");
    assert.equal(delivery.deliveryPrice, 100);
    assert.equal(delivery.pickupPoint.deliveryPrice, 100);
    assert.equal(delivery.pickupPoint.address, "Москва, Тверская, 1");
    assert.equal(delivery.pickupPoint.workHours, "09:00-21:00");
    assert.equal(requestedPointId, "11");
  });

  it("rejects Ozon calculation without a pickup point ID", async () => {
    let lookupCount = 0;
    const service = createDeliveryService(
      {},
      {
        getPickupPoint: async () => {
          lookupCount += 1;
          throw new Error("Point lookup must not be reached");
        },
      },
    );

    await assert.rejects(
      service.calculatePickupPointDelivery(
        { provider: "ozon", pickupPointId: "   " },
        [],
      ),
      (error) =>
        error instanceof BadRequestException &&
        error.message === "delivery.pickupPointId is required",
    );
    assert.equal(lookupCount, 0);
  });

  it("forwards an opaque Ozon point ID byte-for-byte", async () => {
    const pickupPointId = ` Ozon/opaque:001-${"x".repeat(142)} `;
    let requestedPointId: string | undefined;
    const service = createDeliveryService(
      {},
      {
        getPickupPoint: async (id: string) => {
          requestedPointId = id;

          return {
            address: "Москва, Тверская, 1",
            id,
            title: "Ozon ПВЗ",
            workHours: "09:00-21:00",
          };
        },
      },
    );

    const delivery = await service.calculatePickupPointDelivery(
      { provider: "ozon", pickupPointId },
      [],
    );

    assert.equal(pickupPointId.length, 160);
    assert.equal(requestedPointId, pickupPointId);
    assert.equal(delivery.pickupPoint.id, pickupPointId);
  });

  it("resolves the Ozon point again on every calculation", async () => {
    let lookupCount = 0;
    const service = createDeliveryService(
      {},
      {
        getPickupPoint: async (id: string) => {
          lookupCount += 1;

          return {
            address: `Authoritative address ${lookupCount}`,
            id,
            title: "Ozon ПВЗ",
            workHours: `${lookupCount + 8}:00-21:00`,
          };
        },
      },
    );
    const selection = { provider: "ozon", pickupPointId: "11" } as const;

    const calculated = await service.calculatePickupPointDelivery(
      selection,
      [],
    );
    const recalculatedForCreate = await service.calculatePickupPointDelivery(
      selection,
      [],
    );

    assert.equal(lookupCount, 2);
    assert.equal(calculated.deliveryPrice, 100);
    assert.equal(calculated.pickupPoint.deliveryPrice, 100);
    assert.equal(recalculatedForCreate.deliveryPrice, 100);
    assert.equal(recalculatedForCreate.pickupPoint.deliveryPrice, 100);
    assert.equal(
      recalculatedForCreate.pickupPoint.address,
      "Authoritative address 2",
    );
    assert.equal(recalculatedForCreate.pickupPoint.workHours, "10:00-21:00");
  });

  it("keeps CDEK calculation delegation unchanged", async () => {
    const items: DeliveryCartItem[] = [
      {
        id: "product-1",
        lineTotal: 1_000,
        price: 1_000,
        quantity: 1,
        title: "Product 1",
      },
    ];
    const selection: DeliverySelection = {
      cityCode: 44,
      pickupPointId: "cdek-1",
      provider: "cdek",
    };
    const quote: DeliveryQuote = {
      deliveryPrice: 500,
      pickupPoint: {
        address: "CDEK address",
        cityCode: 44,
        deliveryPrice: 500,
        id: "cdek-1",
        title: "CDEK",
        workHours: "09:00-20:00",
      },
      provider: "cdek",
    };
    let cdekInput: unknown;
    let ozonLookupCount = 0;
    const service = createDeliveryService(
      {
        calculatePickupPointDelivery: async (input: unknown) => {
          cdekInput = input;

          return quote;
        },
      },
      {
        getPickupPoint: async () => {
          ozonLookupCount += 1;
          throw new Error("Ozon lookup must not be reached");
        },
      },
    );

    const result = await service.calculatePickupPointDelivery(selection, items);

    assert.strictEqual(result, quote);
    assert.deepEqual(cdekInput, { items, selection });
    assert.equal(ozonLookupCount, 0);
  });

  it("adapts storefront map requests and delegates point lookup", async () => {
    const clusters = [
      {
        coordinate: { lat: 55.76, long: 37.61 },
        isSameBuilding: false,
        mapPointIds: ["11"],
        pointsCount: 1,
      },
    ];
    const points = [
      {
        address: "Москва, Тверская, 1",
        id: "11",
        title: "Ozon ПВЗ",
        workHours: "09:00-21:00",
      },
    ];
    let mapRequest: unknown;
    let requestedPointIds: readonly string[] | undefined;
    const service = createDeliveryService(
      {},
      {
        getMapClusters: async (request: unknown) => {
          mapRequest = request;

          return clusters;
        },
        getPickupPointsByIds: async (mapPointIds: readonly string[]) => {
          requestedPointIds = mapPointIds;

          return points;
        },
      },
    );

    const map = await service.getOzonDeliveryMap({
      viewport: {
        leftBottom: { lat: 55.55, long: 37.35 },
        rightTop: { lat: 55.95, long: 37.85 },
      },
      zoom: 11,
    });
    const resolvedPoints = await service.getOzonDeliveryPoints(["11"]);

    assert.deepEqual(map, { clusters });
    assert.deepEqual(mapRequest, {
      viewport: {
        left_bottom: { lat: 55.55, long: 37.35 },
        right_top: { lat: 55.95, long: 37.85 },
      },
      zoom: 11,
    });
    assert.deepEqual(requestedPointIds, ["11"]);
    assert.deepEqual(resolvedPoints, [
      {
        ...points[0],
        deliveryPrice: 100,
        minimumDeliveryPrice: 100,
      },
    ]);
  });
});

function createDeliveryService(
  cdek: object,
  ozonLogistics: object,
): DeliveryService {
  return new DeliveryService(
    cdek as CdekDeliveryProvider,
    ozonLogistics as OzonLogisticsService,
    new ProviderResponseCacheService(),
  );
}
