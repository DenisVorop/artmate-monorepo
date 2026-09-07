import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { OzonAcquiringService } from "./ozon-acquiring.service";
import { OzonOAuthService } from "./ozon-oauth.service";
import { OzonLogisticsService } from "./ozon-logistics.service";
import { OzonPickupIndexRepository } from "./ozon-pickup-index.repository";
import { OzonPickupIndexReadService } from "./ozon-pickup-index-read.service";
import { OzonPickupIndexSyncService } from "./ozon-pickup-index-sync.service";
import { OzonController } from "./ozon.controller";

@Module({
  imports: [AuthModule],
  controllers: [OzonController],
  providers: [
    OzonAcquiringService,
    OzonOAuthService,
    OzonLogisticsService,
    OzonPickupIndexRepository,
    OzonPickupIndexReadService,
    OzonPickupIndexSyncService,
  ],
  exports: [
    OzonAcquiringService,
    OzonOAuthService,
    OzonLogisticsService,
    OzonPickupIndexReadService,
  ],
})
export class OzonModule {}
