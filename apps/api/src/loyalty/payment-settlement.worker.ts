import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { LoyaltyPaymentSettlementService } from "./payment-settlement.service";

@Injectable()
export class LoyaltyPaymentSettlementWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LoyaltyPaymentSettlementWorker.name);
  private timer?: NodeJS.Timeout;
  private processing = false;
  private stopped = false;

  constructor(private readonly settlement: LoyaltyPaymentSettlementService) {}

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

  async poll(): Promise<void> {
    if (this.processing || this.stopped) return;
    this.processing = true;
    try {
      await this.settlement.processDueEvents();
    } catch {
      this.logger.warn("Loyalty payment settlement polling failed");
    } finally {
      this.processing = false;
    }
  }
}
