import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminAffiliateController,
  AffiliateController,
} from "./affiliate.controller";
import { AffiliateService } from "./affiliate.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AffiliateController, AdminAffiliateController],
  providers: [AffiliateService],
})
export class AffiliateModule {}
