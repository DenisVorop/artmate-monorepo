import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ContestEntriesService } from "../../contests/contest-entries.service";
import { ContestDrawService } from "../../contests/contest-draw.service";

@Injectable()
export class ContestDrawJob {
  constructor(
    private readonly draws: ContestDrawService,
    private readonly entries: ContestEntriesService,
  ) {}
  @Cron(CronExpression.EVERY_SECOND, {
    name: "contest-submissions",
    waitForCompletion: true,
  })
  async resumeSubmissions() {
    await this.entries.processPendingSubmissions();
  }
  @Cron(CronExpression.EVERY_MINUTE, {
    name: "contest-draw",
    waitForCompletion: true,
  })
  async run() {
    await this.draws.runDue();
  }
}
