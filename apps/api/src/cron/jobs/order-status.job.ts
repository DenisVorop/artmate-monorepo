import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderDeliveryStatusService } from "../../orders/delivery-status/order-delivery-status.service";

@Injectable()
export class OrderStatusJob {
  constructor(private readonly orderStatuses: OrderDeliveryStatusService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "order-delivery-status",
    waitForCompletion: true,
  })
  async run() {
    await this.orderStatuses.updateStatuses();
  }
}
