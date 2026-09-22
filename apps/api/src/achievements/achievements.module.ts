import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AchievementsController } from "./achievements.controller";
import { AchievementsService } from "./achievements.service";
import { AchievementBadgeService } from "./badge.service";
import { AchievementBadgeWorker } from "./badge.worker";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AchievementsController],
  providers: [
    AchievementsService,
    AchievementBadgeService,
    AchievementBadgeWorker,
  ],
})
export class AchievementsModule {}
