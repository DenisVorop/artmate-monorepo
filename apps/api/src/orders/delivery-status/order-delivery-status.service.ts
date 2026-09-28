import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../orders.service";
import { OrdersStorage } from "../orders.storage";

@Injectable()
export class OrderDeliveryStatusService {
  private readonly logger = new Logger(OrderDeliveryStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: OrdersStorage,
    private readonly orders: OrdersService,
  ) {}

  async updateStatuses(): Promise<void> {
    const events = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT e.id FROM delivery_completion_events e
      LEFT JOIN order_delivery_completion_receipts r ON r.event_id = e.id
      WHERE r.event_id IS NULL ORDER BY e.observed_at, e.id LIMIT 100
    `;
    for (const event of events) {
      try {
        await this.storage.applyDeliveryCompletion(event.id, (tx, result) =>
          this.orders.enqueueStatusChangeNotifications(tx, result),
        );
      } catch {
        this.logger.warn(
          "Delivery completion processing failed; unacknowledged event will retry",
        );
      }
    }
  }
}
