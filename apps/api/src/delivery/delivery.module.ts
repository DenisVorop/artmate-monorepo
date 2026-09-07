import { Module } from "@nestjs/common";

import { OzonModule } from "../ozon/ozon.module";

import { CdekClientService } from "./providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
import { CdekWebhookService } from "./providers/cdek/cdek-webhook.service";
import { DeliveryController } from "./delivery.controller";
import { DeliveryProxyThrottleService } from "./delivery-proxy-throttle.service";
import { DeliveryService } from "./delivery.service";
import { ProviderResponseCacheService } from "./provider-response-cache.service";

@Module({
  imports: [OzonModule],
  controllers: [DeliveryController],
  providers: [
    CdekClientService,
    CdekWebhookService,
    CdekDeliveryProvider,
    DeliveryProxyThrottleService,
    ProviderResponseCacheService,
    DeliveryService,
  ],
  exports: [DeliveryProxyThrottleService, DeliveryService],
})
export class DeliveryModule {}
