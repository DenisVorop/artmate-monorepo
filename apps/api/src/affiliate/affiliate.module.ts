import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminAffiliateController,
  AffiliateController,
} from "./affiliate.controller";
import {
  AdminAffiliateCodesController,
  AffiliateCodesController,
} from "./affiliate-codes.controller";
import { AffiliateCodesService } from "./affiliate-codes.service";
import { AffiliateService } from "./affiliate.service";
import { AffiliateFinancialAccountingService } from "./financial-accounting.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [
    AffiliateController,
    AdminAffiliateController,
    AffiliateCodesController,
    AdminAffiliateCodesController,
  ],
  providers: [
    AffiliateService,
    AffiliateCodesService,
    AffiliateFinancialAccountingService,
  ],
  exports: [AffiliateFinancialAccountingService],
})
export class AffiliateModule {}
