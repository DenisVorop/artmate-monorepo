import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { OzonAcquiringService } from "./ozon-acquiring.service";
import { OzonOAuthService } from "./ozon-oauth.service";
import { OzonLogisticsService } from "./ozon-logistics.service";
import { OzonController } from "./ozon.controller";

@Module({
  imports: [AuthModule],
  controllers: [OzonController],
  providers: [OzonAcquiringService, OzonOAuthService, OzonLogisticsService],
  exports: [OzonAcquiringService, OzonOAuthService, OzonLogisticsService],
})
export class OzonModule {}
