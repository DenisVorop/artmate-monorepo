import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { DeliveryModule } from "../delivery/delivery.module";
import { NotificationQueueModule } from "../notifications/notification-queue.module";
import { OzonModule } from "../ozon/ozon.module";
import { PromocodesModule } from "../promocodes/promocodes.module";
import { TBankModule } from "../tbank/tbank.module";
import { UsersModule } from "../users/users.module";

import { CheckoutThrottleService } from "./checkout-throttle.service";
import { OrdersController } from "./orders.controller";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";
import { OzonPaymentRecheckService } from "./ozon-payment-recheck.service";

@Module({
  imports: [
    AuthModule,
    CartModule,
    DeliveryModule,
    NotificationQueueModule,
    OzonModule,
    PromocodesModule,
    TBankModule,
    UsersModule,
  ],
  controllers: [OrdersController],
  providers: [
    CheckoutThrottleService,
    OrdersService,
    OrdersStorage,
    OrdersTelegramService,
    OzonPaymentRecheckService,
  ],
})
export class OrdersModule {}
