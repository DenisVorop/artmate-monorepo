import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { LoyaltyPurchaseSettlementService } from "./purchase-settlement.service";

@Injectable()
export class LoyaltyPurchaseSettlementWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LoyaltyPurchaseSettlementWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;
  constructor(private readonly purchases: LoyaltyPurchaseSettlementService) {}

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
      await this.purchases.processDueOrders();
    } catch {
      this.logger.warn(
        "Purchase reward polling failed; source facts remain in the database",
      );
    } finally {
      this.busy = false;
    }
  }
}
