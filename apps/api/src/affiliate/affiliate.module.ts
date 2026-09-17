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
import {
  AdminAffiliateAnalyticsController,
  AffiliateAnalyticsController,
} from "./affiliate-analytics.controller";
import { AffiliateAnalyticsService } from "./affiliate-analytics.service";
import {
  AdminAffiliatePayoutsController,
  AffiliatePayoutsController,
} from "./affiliate-payouts.controller";
import { AffiliatePayoutBalanceService } from "./affiliate-payout-balance.service";
import { AffiliatePayoutsService } from "./affiliate-payouts.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [
    AffiliateController,
    AdminAffiliateController,
    AffiliateCodesController,
    AdminAffiliateCodesController,
    AffiliateAnalyticsController,
    AdminAffiliateAnalyticsController,
    AffiliatePayoutsController,
    AdminAffiliatePayoutsController,
  ],
  providers: [
    AffiliateService,
    AffiliateCodesService,
    AffiliateFinancialAccountingService,
    AffiliateAnalyticsService,
    AffiliatePayoutBalanceService,
    AffiliatePayoutsService,
  ],
  exports: [AffiliateFinancialAccountingService, AffiliatePayoutsService],
})
export class AffiliateModule {}
