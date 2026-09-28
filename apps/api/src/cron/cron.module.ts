import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DeliveryTrackingModule } from "../delivery-tracking/delivery-tracking.module";
import { OrdersModule } from "../orders/orders.module";
import { DeliveryTrackingJob } from "./jobs/delivery-tracking.job";
import { OrderStatusJob } from "./jobs/order-status.job";

// Application scheduling lives here. Jobs only call exported service methods;
// domain modules do not import CronModule or depend on the scheduler.
@Module({
  imports: [ScheduleModule.forRoot(), DeliveryTrackingModule, OrdersModule],
  providers: [DeliveryTrackingJob, OrderStatusJob],
})
export class CronModule {}
