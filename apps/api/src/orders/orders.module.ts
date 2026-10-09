import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { CartModule } from "../cart/cart.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { NotificationQueueModule } from "../notifications/notification-queue.module";
import { OzonModule } from "../ozon/ozon.module";
import { PromocodesModule } from "../promocodes/promocodes.module";
import { ProductsModule } from "../products/products.module";
import { TBankModule } from "../tbank/tbank.module";
import { UsersModule } from "../users/users.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { OrdersLoyaltyService } from "./orders-loyalty.service";
import { OrderDeliveryStatusService } from "./delivery-status/order-delivery-status.service";

import { CheckoutThrottleService } from "./checkout-throttle.service";
import { OrdersController } from "./orders.controller";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";
import { PaymentRecoveryService } from "./payment-recovery/payment-recovery.service";
import { PaymentRecoveryWorker } from "./payment-recovery/payment-recovery.worker";
import { OrderRefundsService } from "./refunds/order-refunds.service";

@Module({
  imports: [
    AuthModule,
    AffiliateModule,
    CartModule,
    DeliveryModule,
    NotificationQueueModule,
    OzonModule,
    PromocodesModule,
    ProductsModule,
    TBankModule,
    UsersModule,
    LoyaltyModule,
  ],
  controllers: [OrdersController],
  providers: [
    CheckoutThrottleService,
    OrdersService,
    OrdersStorage,
    OrdersLoyaltyService,
    OrdersTelegramService,
    PaymentRecoveryService,
    PaymentRecoveryWorker,
    OrderRefundsService,
    OrderDeliveryStatusService,
  ],
  exports: [OrderDeliveryStatusService],
})
export class OrdersModule {}
