import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DeliveryService } from "../src/delivery/delivery.service";
import type { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import type { DeliverySelection } from "../src/delivery/providers/delivery-provider.interface";
import { ProviderResponseCacheService } from "../src/delivery/provider-response-cache.service";
import type { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonCityPickupPointsService } from "../src/delivery/ozon-city-pickup-points.service";

describe("delivery pricing contract", () => {
  it("returns the server-owned 100 RUB Ozon minimum with pickup points", async () => {
    const service = createService(
      {},
      {
        getPickupPoints: async () => [
          {
            address: "Москва, Тверская, 1",
            deliveryPrice: 1,
            id: "ozon-1",
            title: "Ozon ПВЗ",
            workHours: "09:00-21:00",
          },
        ],
      },
    );

    const [point] = await service.getOzonPickupPoints(44);

    assert.ok(point);
    assert.equal(point.deliveryPrice, 100);
    assert.equal(
      (point as typeof point & { minimumDeliveryPrice?: number })
        .minimumDeliveryPrice,
      100,
    );
  });

  it("ignores a client-supplied delivery amount when calculating Ozon delivery", async () => {
    const service = createService({
      getPickupPoint: async (id: string) => ({
        address: "Москва, Тверская, 1",
        deliveryPrice: 1,
        id,
        title: "Ozon ПВЗ",
        workHours: "09:00-21:00",
      }),
    });
    const untrustedSelection = {
      deliveryPrice: 1,
      pickupPointId: "ozon-1",
      provider: "ozon",
    } as DeliverySelection;

    const quote = await service.calculatePickupPointDelivery(
      untrustedSelection,
      [],
    );

    assert.equal(quote.deliveryPrice, 100);
    assert.equal(quote.pickupPoint.deliveryPrice, 100);
  });
});

function createService(
  ozonLogistics: object,
  ozonCityPickupPoints: object = {},
) {
  return new DeliveryService(
    {
      getCity: async () => ({
        code: 44,
        countryCode: "RU",
        latitude: 55.75,
        longitude: 37.61,
        name: "Москва",
        region: "Москва",
      }),
    } as unknown as CdekDeliveryProvider,
    ozonLogistics as OzonLogisticsService,
    new ProviderResponseCacheService(),
    ozonCityPickupPoints as OzonCityPickupPointsService,
  );
}
