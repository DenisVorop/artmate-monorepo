import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";

import { OrdersService } from "../orders.service";
import { PaymentRecoveryService } from "./payment-recovery.service";

@Injectable()
export class PaymentRecoveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRecoveryWorker.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private stopped = false;

  constructor(
    private readonly recovery: PaymentRecoveryService,
    private readonly orders: OrdersService,
  ) {}

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
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      for (let index = 0; index < 5 && !this.stopped; index += 1) {
        const lease = await this.recovery.claimNext();
        if (!lease) break;
        try {
          await this.recovery.settle(
            lease,
            await this.orders.reconcilePayment(lease.orderId),
          );
        } catch {
          await this.recovery.settle(lease, {
            state: "pending",
            reason: "provider_error",
          });
        }
      }
    } catch {
      this.logger.warn(
        "Payment recovery polling failed; durable lease will retry",
      );
    } finally {
      this.busy = false;
    }
  }
}
