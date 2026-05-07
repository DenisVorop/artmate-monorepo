import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { BlogModule } from "./blog/blog.module";
import { CartModule } from "./cart/cart.module";
import { CsrfMiddleware } from "./common/csrf.middleware";
import { SecurityHeadersMiddleware } from "./common/security-headers.middleware";
import { ContactsModule } from "./contacts/contacts.module";
import { ContentAssistantModule } from "./content-assistant/content-assistant.module";
import { OrdersModule } from "./orders/orders.module";
import { OzonModule } from "./ozon/ozon.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { SeoModule } from "./seo/seo.module";
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
    SeoModule,
    ContentAssistantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware, CsrfMiddleware).forRoutes("*");
  }
}
