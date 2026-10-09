import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { DeliveryTrackingService } from "../../delivery-tracking/delivery-tracking.service";

@Injectable()
export class DeliveryTrackingJob {
  constructor(private readonly deliveryTracking: DeliveryTrackingService) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: "delivery-tracking",
    waitForCompletion: true,
  })
  async run() {
    await this.deliveryTracking.synchronize();
  }
}
