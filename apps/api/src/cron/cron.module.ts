import { ContestPrizesJob } from "./jobs/contest-prizes.job";
import { PromocodesModule } from "../promocodes/promocodes.module";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { DeliveryTrackingModule } from "../delivery-tracking/delivery-tracking.module";
import { OrdersModule } from "../orders/orders.module";
import { LikesModule } from "../likes/likes.module";
import { ContestsModule } from "../contests/contests.module";
import { ContestDrawJob } from "./jobs/contest-draw.job";
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
    PromocodesModule,
    LikesModule,
    ContestsModule,
  ],
  providers: [
    DeliveryTrackingJob,
    OrderStatusJob,
    OrderStatusMonitorService,
    OrderStatusMonitorJob,
    LikesCleanupJob,
    ContestDrawJob,
    ContestPrizesJob,
  ],
})
export class CronModule {}
