import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderPrizesService } from "../../orders/prizes/prizes.service";
import { ContestPromoPrizesService } from "../../promocodes/contest-promo-prizes.service";
@Injectable()
export class ContestPrizesJob {
  constructor(
    private readonly prizes: OrderPrizesService,
    private readonly promos: ContestPromoPrizesService,
  ) {}
  @Cron(CronExpression.EVERY_MINUTE, {
    name: "contest-prizes",
    waitForCompletion: true,
  })
  async run() {
    await this.prizes.issueForWinners();
    await this.promos.issueForWinners();
  }
}
