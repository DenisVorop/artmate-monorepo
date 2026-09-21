import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { LoyaltyPurchaseHistoryService } from "./purchase-history.service";

@Injectable()
export class LoyaltyPurchaseHistoryWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LoyaltyPurchaseHistoryWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;
  constructor(private readonly history: LoyaltyPurchaseHistoryService) {}

  onModuleInit() {
    this.stopped = false;
    this.timer = setInterval(() => {
      void this.poll();
    }, 15_000);
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
      await this.history.processDueMembers();
    } catch {
      this.logger.warn(
        "Purchase history polling failed; source facts remain in the database",
      );
    } finally {
      this.busy = false;
    }
  }
}
