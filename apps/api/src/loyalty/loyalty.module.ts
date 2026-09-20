import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { LoyaltyMembershipService } from "./membership.service";
import { LoyaltyWalletService } from "./wallet.service";

@Module({
  imports: [PrismaModule],
  providers: [LoyaltyMembershipService, LoyaltyWalletService],
  exports: [LoyaltyMembershipService, LoyaltyWalletService],
})
export class LoyaltyModule {}
