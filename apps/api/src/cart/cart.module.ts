import { Module } from "@nestjs/common";

import { ProductsModule } from "../products/products.module";

import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";
import { CartStorage } from "./cart.storage";

@Module({
  imports: [ProductsModule],
  controllers: [CartController],
  providers: [CartService, CartStorage],
  exports: [CartService, CartStorage],
})
export class CartModule {}
