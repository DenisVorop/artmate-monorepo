import { Module } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BlogModule } from "./blog/blog.module";
import { CartModule } from "./cart/cart.module";
import { ContactsModule } from "./contacts/contacts.module";
import { OrdersModule } from "./orders/orders.module";
import { OzonModule } from "./ozon/ozon.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    CartModule,
    OrdersModule,
    ProductsModule,
    BlogModule,
    OzonModule,
    ContactsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
