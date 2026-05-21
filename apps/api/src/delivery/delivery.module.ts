import { Module } from "@nestjs/common";

import { CdekClientService } from "./providers/cdek/cdek-client.service";
import { CdekDeliveryProvider } from "./providers/cdek/cdek-delivery.provider";
import { DeliveryController } from "./delivery.controller";
import { DeliveryService } from "./delivery.service";

@Module({
  controllers: [DeliveryController],
  providers: [CdekClientService, CdekDeliveryProvider, DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
