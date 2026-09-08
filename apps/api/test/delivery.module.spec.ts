import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { DeliveryService } from "../src/delivery/delivery.service";
import { CdekClientService } from "../src/delivery/providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "../src/delivery/providers/cdek/cdek-delivery.provider";
import { ProviderResponseCacheService } from "../src/delivery/provider-response-cache.service";
import { DeliveryCacheRepository } from "../src/delivery/delivery-cache.repository";
import { NominatimLocalityService } from "../src/delivery/nominatim-locality.service";
import { OzonCityPickupPointsService } from "../src/delivery/ozon-city-pickup-points.service";
import { OzonLogisticsService } from "../src/ozon/ozon-logistics.service";
import { OzonOAuthService } from "../src/ozon/ozon-oauth.service";

@Module({
  providers: [
    CdekClientService,
    CdekDeliveryProvider,
    DeliveryService,
    OzonLogisticsService,
    NominatimLocalityService,
    OzonCityPickupPointsService,
    ProviderResponseCacheService,
    { provide: DeliveryCacheRepository, useValue: {} },
    { provide: OzonOAuthService, useValue: {} },
  ],
})
class DeliveryResolutionModule {}

describe("DeliveryModule", () => {
  it("resolves DeliveryService from the Nest application context", async () => {
    const context = await NestFactory.createApplicationContext(
      DeliveryResolutionModule,
      {
        abortOnError: false,
        logger: false,
      },
    );

    try {
      assert.ok(context.get(DeliveryService) instanceof DeliveryService);
    } finally {
      await context.close();
    }
  });
});
