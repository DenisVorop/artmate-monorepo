import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { OzonModule } from "../ozon/ozon.module";
import { UsersModule } from "../users/users.module";

import { OrdersController } from "./orders.controller";
import { OrdersTelegramService } from "./orders-telegram.service";
import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";

@Module({
  imports: [AuthModule, CartModule, OzonModule, UsersModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStorage, OrdersTelegramService],
})
export class OrdersModule {}
