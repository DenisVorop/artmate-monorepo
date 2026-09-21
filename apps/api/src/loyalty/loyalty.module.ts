import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { LoyaltyMembershipService } from "./membership.service";
import { LoyaltyWalletService } from "./wallet.service";
import { LoyaltyPaymentSettlementService } from "./payment-settlement.service";
import { LoyaltyPaymentSettlementWorker } from "./payment-settlement.worker";
import { LoyaltyRefundSettlementService } from "./refund-settlement.service";
import { LoyaltyRefundSettlementWorker } from "./refund-settlement.worker";
import { LoyaltyPurchaseSettlementService } from "./purchase-settlement.service";
import { LoyaltyPurchaseSettlementWorker } from "./purchase-settlement.worker";
import { LoyaltyHistoryPreviewService } from "./history-preview.service";
import { LoyaltyPurchaseHistoryService } from "./purchase-history.service";
import { LoyaltyPurchaseHistoryWorker } from "./purchase-history.worker";
import { LoyaltyWorkRewardService } from "./work-reward.service";
import { LoyaltyWorkRewardWorker } from "./work-reward.worker";
import { LoyaltyAchievementAwardService } from "./achievement-award.service";
import { LoyaltyAchievementAwardWorker } from "./achievement-award.worker";
import { LoyaltyHistoryFinalizationService } from "./history-finalization.service";
import { LoyaltyHistoryFinalizationWorker } from "./history-finalization.worker";

@Module({
  imports: [PrismaModule],
  providers: [
    LoyaltyMembershipService,
    LoyaltyWalletService,
    LoyaltyPaymentSettlementService,
    LoyaltyPaymentSettlementWorker,
    LoyaltyRefundSettlementService,
    LoyaltyRefundSettlementWorker,
    LoyaltyPurchaseSettlementService,
    LoyaltyPurchaseSettlementWorker,
    LoyaltyHistoryPreviewService,
    LoyaltyPurchaseHistoryService,
    LoyaltyPurchaseHistoryWorker,
    LoyaltyWorkRewardService,
    LoyaltyWorkRewardWorker,
    LoyaltyAchievementAwardService,
    LoyaltyAchievementAwardWorker,
    LoyaltyHistoryFinalizationService,
    LoyaltyHistoryFinalizationWorker,
  ],
  exports: [LoyaltyMembershipService, LoyaltyWalletService],
})
export class LoyaltyModule {}
