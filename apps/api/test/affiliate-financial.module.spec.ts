import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AffiliateFinancialAccountingService } from "../src/affiliate/financial-accounting.service";
import { AffiliatePayoutBalanceService } from "../src/affiliate/affiliate-payout-balance.service";
import { AffiliatePayoutsService } from "../src/affiliate/affiliate-payouts.service";
import { AnalyticsOutboxService } from "../src/analytics/analytics-outbox.service";
import { OrderActivationService } from "../src/auth/order-activation.service";
import { OrdersStorage } from "../src/orders/orders.storage";
import { OrderRefundsService } from "../src/orders/refunds/order-refunds.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { PromocodesService } from "../src/promocodes/promocodes.service";

@Module({
  providers: [
    AffiliateFinancialAccountingService,
    AffiliatePayoutBalanceService,
    AffiliatePayoutsService,
    OrderRefundsService,
    OrdersStorage,
    { provide: PrismaService, useValue: {} },
    { provide: PromocodesService, useValue: {} },
    { provide: OrderActivationService, useValue: {} },
    { provide: AnalyticsOutboxService, useValue: {} },
  ],
})
class AffiliateFinancialResolutionModule {}

describe("affiliate financial Nest wiring", () => {
  it("resolves accounting, refunds and payment storage with one required accounting provider", async () => {
    const context = await NestFactory.createApplicationContext(
      AffiliateFinancialResolutionModule,
      { abortOnError: false, logger: false },
    );
    try {
      assert.ok(
        context.get(AffiliateFinancialAccountingService) instanceof
          AffiliateFinancialAccountingService,
      );
      assert.ok(
        context.get(OrderRefundsService) instanceof OrderRefundsService,
      );
      assert.ok(context.get(OrdersStorage) instanceof OrdersStorage);
    } finally {
      await context.close();
    }
  });
});
