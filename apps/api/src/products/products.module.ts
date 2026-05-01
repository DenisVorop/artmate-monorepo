import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminProductsController,
  CatalogProductsController,
} from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [AdminProductsController, CatalogProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
