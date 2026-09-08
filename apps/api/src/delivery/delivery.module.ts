import { Module } from "@nestjs/common";

import { OzonModule } from "../ozon/ozon.module";

import { CdekClientService } from "./providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
import { CdekWebhookService } from "./providers/cdek/cdek-webhook.service";
import { DeliveryController } from "./delivery.controller";
import { DeliveryCacheRepository } from "./delivery-cache.repository";
import { DeliveryProxyThrottleService } from "./delivery-proxy-throttle.service";
import { DeliveryService } from "./delivery.service";
import { NominatimLocalityService } from "./nominatim-locality.service";
import { OzonCityPickupPointsService } from "./ozon-city-pickup-points.service";
import { ProviderResponseCacheService } from "./provider-response-cache.service";

@Module({
  imports: [OzonModule],
  controllers: [DeliveryController],
  providers: [
    CdekClientService,
    CdekWebhookService,
    CdekDeliveryProvider,
    DeliveryCacheRepository,
    DeliveryProxyThrottleService,
    NominatimLocalityService,
    OzonCityPickupPointsService,
    ProviderResponseCacheService,
    DeliveryService,
  ],
  exports: [DeliveryProxyThrottleService, DeliveryService],
})
export class DeliveryModule {}
