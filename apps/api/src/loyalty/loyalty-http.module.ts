import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { LoyaltyAchievementDraftsController } from "./achievement-drafts.controller";
import { LoyaltyAchievementDraftsService } from "./achievement-drafts.service";
import { LoyaltyAchievementImageController } from "./achievement-image.controller";
import { LoyaltyAchievementImageService } from "./achievement-image.service";
import { AdminAchievementsGuard } from "./admin-achievements.guard";
import { LoyaltyController } from "./loyalty.controller";
import { LoyaltyModule } from "./loyalty.module";

@Module({
  imports: [AuthModule, UsersModule, LoyaltyModule],
  controllers: [
    LoyaltyController,
    LoyaltyAchievementDraftsController,
    LoyaltyAchievementImageController,
  ],
  providers: [
    LoyaltyAchievementDraftsService,
    LoyaltyAchievementImageService,
    AdminAchievementsGuard,
  ],
})
export class LoyaltyHttpModule {}
