import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartModule } from "../cart/cart.module";
import { OzonModule } from "../ozon/ozon.module";

import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";

@Module({
  imports: [AuthModule, CartModule, OzonModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStorage],
})
export class OrdersModule {}
