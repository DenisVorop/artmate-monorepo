import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { LoyaltyWorkRewardService } from "./work-reward.service";

@Injectable()
export class LoyaltyWorkRewardWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LoyaltyWorkRewardWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;

  constructor(private readonly rewards: LoyaltyWorkRewardService) {}

  onModuleInit() {
    this.stopped = false;
    this.timer = setInterval(() => void this.poll(), 15_000);
    this.timer.unref();
    void this.poll();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async poll() {
    if (this.stopped || this.busy) return;
    this.busy = true;
    try {
      await this.rewards.processDueMembers();
    } catch {
      this.logger.warn(
        "Work reward polling failed; publication facts remain in the database",
      );
    } finally {
      this.busy = false;
    }
  }
}
