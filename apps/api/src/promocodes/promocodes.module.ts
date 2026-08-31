import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminPromocodesController,
  PublicPromocodesController,
} from "./promocodes.controller";
import { PromocodesThrottleService } from "./promocodes-throttle.service";
import { PromocodesService } from "./promocodes.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PublicPromocodesController, AdminPromocodesController],
  providers: [PromocodesService, PromocodesThrottleService],
  exports: [PromocodesService],
})
export class PromocodesModule {}
