import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { DeliveryTrackingService } from "./delivery-tracking.service";
import { OzonPostingClient } from "./ozon-posting.client";
import { TrackingStorage } from "./tracking.storage";

@Module({
  imports: [PrismaModule],
  providers: [DeliveryTrackingService, TrackingStorage, OzonPostingClient],
  exports: [DeliveryTrackingService],
})
export class DeliveryTrackingModule {}
