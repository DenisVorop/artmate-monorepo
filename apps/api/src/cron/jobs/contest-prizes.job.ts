import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderPrizesService } from "../../orders/prizes/prizes.service";
import { ContestPromoPrizesService } from "../../promocodes/contest-promo-prizes.service";
@Injectable()
export class ContestPrizesJob {
  private readonly logger = new Logger(ContestPrizesJob.name);
  constructor(
    private readonly prizes: OrderPrizesService,
    private readonly promos: ContestPromoPrizesService,
  ) {}
  @Cron(CronExpression.EVERY_MINUTE, {
    name: "contest-prizes",
    waitForCompletion: true,
  })
  async run() {
    const results = await Promise.allSettled([
      this.prizes.issueAwards(),
      this.promos.issueAwards(),
    ]);
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected")
        this.logger.error(
          `Contest ${index === 0 ? "product" : "promo"} prize issuance failed`,
          result.reason instanceof Error ? result.reason.stack : result.reason,
        );
    }
  }
}
