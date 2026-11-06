import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { LikesCleanupService } from "../../likes/cleanup.service";

@Injectable()
export class LikesCleanupJob {
  constructor(private readonly cleanup: LikesCleanupService) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: "likes-cleanup",
    waitForCompletion: true,
  })
  async run() {
    await this.cleanup.reconcile();
  }
}
