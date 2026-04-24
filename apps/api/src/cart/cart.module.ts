import { Module } from "@nestjs/common";

import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { CartStorage } from "./cart.storage";

@Module({
  controllers: [CartController],
  providers: [CartService, CartStorage],
  exports: [CartService, CartStorage],
})
export class CartModule {}
