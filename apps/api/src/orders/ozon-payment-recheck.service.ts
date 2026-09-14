import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";

const ozonPaymentRecheckPollMs = 5_000;
const ozonPaymentRecheckBatchSize = 5;
const statusCheckFailedCode = "status_check_failed";

@Injectable()
export class OzonPaymentRecheckService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OzonPaymentRecheckService.name);
  private isProcessing = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly ordersStorage: OrdersStorage,
    private readonly ordersService: OrdersService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.processDueRechecks();
    }, ozonPaymentRecheckPollMs);
    void this.processDueRechecks();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async processDueRechecks(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      for (
        let processed = 0;
        processed < ozonPaymentRecheckBatchSize;
        processed += 1
      ) {
        const lease = await this.ordersStorage.claimOzonPaymentRecheck();
        if (!lease) break;

        try {
          await this.ordersService.recheckOzonPaymentNotification(lease);
        } catch {
          this.logger.warn(
            `Ozon payment recheck failed for order ${lease.orderId}: ${statusCheckFailedCode}`,
          );
          try {
            await this.ordersStorage.failOzonPaymentRecheck(
              lease,
              statusCheckFailedCode,
            );
          } catch {
            this.logger.warn(
              `Ozon payment recheck persistence failed for order ${lease.orderId}`,
            );
          }
        }
      }
    } catch {
      this.logger.warn("Ozon payment recheck polling failed");
    } finally {
      this.isProcessing = false;
    }
  }
}
