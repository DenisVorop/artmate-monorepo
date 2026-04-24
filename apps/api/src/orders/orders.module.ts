import { Module } from "@nestjs/common";

import { CartModule } from "../cart/cart.module";

import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrdersStorage } from "./orders.storage";

@Module({
  imports: [CartModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersStorage],
})
export class OrdersModule {}
