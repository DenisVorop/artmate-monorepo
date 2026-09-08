import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadGatewayException, NotFoundException } from "@nestjs/common";
import { DeliveryService } from "../src/delivery/delivery.service";
import { ProviderResponseCacheService } from "../src/delivery/provider-response-cache.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import type { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import type { OzonCityPickupPointsService } from "../src/delivery/ozon-city-pickup-points.service";

const city = {
  code: 44,
  country_code: "RU",
  city: "Москва",
  region: "Москва",
  latitude: 55.75,
  longitude: 37.61,
};
function providerWithResponse(response: unknown) {
  const client = new CdekClientService();
  client.request = async <T>() => response as T;
  return new CdekDeliveryProvider(client);
}
function createService(provider: Partial<CdekDeliveryProvider>) {
  return new DeliveryService(
    provider as CdekDeliveryProvider,
    {} as OzonLogisticsService,
    new ProviderResponseCacheService(),
    {} as OzonCityPickupPointsService,
  );
}

describe("CDEK city public safety", () => {
  for (const value of [
    "",
    "   ",
    "55.75",
    null,
    undefined,
    false,
    [],
    {},
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ]) {
    it(`rejects non-numeric coordinates ${JSON.stringify(value)}`, async () => {
      for (const field of ["latitude", "longitude"]) {
        await assert.rejects(
          providerWithResponse([{ ...city, [field]: value }]).getCity(44),
          BadGatewayException,
        );
      }
    });
  }
  for (const response of [
    [null],
    [undefined],
    ["city"],
    [false],
    [[]],
    null,
    {},
  ]) {
    it(`rejects malformed city response ${JSON.stringify(response)} safely`, async () => {
      await assert.rejects(
        providerWithResponse(response).getCity(44),
        BadGatewayException,
      );
    });
  }
  it("accepts numeric zero coordinates without inventing a fallback", async () => {
    const result = await providerWithResponse([
      { ...city, latitude: 0, longitude: 0 },
    ]).getCity(44);
    assert.equal(result.latitude, 0);
    assert.equal(result.longitude, 0);
  });
  for (const method of ["searchCdekCities", "getCdekCity"] as const) {
    it(`redacts provider errors and does not cache failures for ${method}`, async () => {
      let calls = 0;
      const fail = async () => {
        calls += 1;
        throw new BadGatewayException({
          message: "private-diagnostic-marker",
          body: "private-upstream-body",
        });
      };
      const service = createService({ searchCities: fail, getCity: fail });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await assert.rejects(
          method === "searchCdekCities"
            ? service.searchCdekCities("Москва")
            : service.getCdekCity(44),
          (error: unknown) => {
            assert.ok(error instanceof BadGatewayException);
            assert.equal(
              JSON.stringify(error.getResponse()).includes("private-"),
              false,
            );
            return true;
          },
        );
      }
      assert.equal(calls, 2);
    });
  }
  it("retains a safe not-found response for unknown city code", async () => {
    const service = createService({
      getCity: async () => {
        throw new NotFoundException({ message: "private-provider-detail" });
      },
    });
    await assert.rejects(service.getCdekCity(44), (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.equal(
        JSON.stringify(error.getResponse()).includes("private-"),
        false,
      );
      return true;
    });
  });
});
