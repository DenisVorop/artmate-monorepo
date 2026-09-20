import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyModule } from "./loyalty.module";

@Module({
  imports: [AuthModule, LoyaltyModule],
  controllers: [LoyaltyController],
})
export class LoyaltyHttpModule {}
