import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrderStatusMonitorService } from "../order-status-monitor.service";

@Injectable()
export class OrderStatusMonitorJob {
  constructor(private readonly monitor: OrderStatusMonitorService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "order-status-monitor",
    waitForCompletion: true,
  })
  async run() {
    await this.monitor.check();
  }
}
