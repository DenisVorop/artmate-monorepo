import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DeliveryTrackingModule } from "../delivery-tracking/delivery-tracking.module";
import { OrdersModule } from "../orders/orders.module";
import { LikesModule } from "../likes/likes.module";
import { LikesCleanupJob } from "./jobs/likes-cleanup.job";
import { DeliveryTrackingJob } from "./jobs/delivery-tracking.job";
import { OrderStatusJob } from "./jobs/order-status.job";
import { OrderStatusMonitorJob } from "./jobs/order-status-monitor.job";
import { OrderStatusMonitorService } from "./order-status-monitor.service";

// Application scheduling lives here. Jobs only call exported service methods;
// domain modules do not import CronModule or depend on the scheduler.
@Module({
  imports: [
    ScheduleModule.forRoot(),
    DeliveryTrackingModule,
    OrdersModule,
    LikesModule,
  ],
  providers: [
    DeliveryTrackingJob,
    OrderStatusJob,
    OrderStatusMonitorService,
    OrderStatusMonitorJob,
    LikesCleanupJob,
  ],
})
export class CronModule {}
