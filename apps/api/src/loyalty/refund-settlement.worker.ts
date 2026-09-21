import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { LoyaltyRefundSettlementService } from "./refund-settlement.service";

@Injectable()
export class LoyaltyRefundSettlementWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LoyaltyRefundSettlementWorker.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private stopped = false;

  constructor(private readonly settlement: LoyaltyRefundSettlementService) {}

  onModuleInit() {
    if (this.timer) return;
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

  async poll(): Promise<void> {
    if (this.processing || this.stopped) return;
    this.processing = true;
    try {
      await this.settlement.processDueEvents();
    } catch {
      this.logger.warn("Loyalty refund settlement polling failed");
    } finally {
      this.processing = false;
    }
  }
}
