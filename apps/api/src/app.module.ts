import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AchievementsModule } from "./achievements/achievements.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AffiliateModule } from "./affiliate/affiliate.module";
import { ConsentsModule } from "./consents/consents.module";
import { AuthModule } from "./auth/auth.module";
import { BlogModule } from "./blog/blog.module";
import { CartModule } from "./cart/cart.module";
import { CatalogLandingsModule } from "./catalog-landings/catalog-landings.module";
import { ColoringsModule } from "./colorings/colorings.module";
import { CsrfMiddleware } from "./common/csrf.middleware";
import { SecurityHeadersMiddleware } from "./common/security-headers.middleware";
import { ContactsModule } from "./contacts/contacts.module";
import { CronModule } from "./cron/cron.module";
import { ContentAssistantModule } from "./content-assistant/content-assistant.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { FeatureBannersModule } from "./feature-banners/feature-banners.module";
import { OrdersModule } from "./orders/orders.module";
import { LoyaltyHttpModule } from "./loyalty/loyalty-http.module";
import { OzonModule } from "./ozon/ozon.module";
import { PartnerApplicationsModule } from "./partner-applications/partner-applications.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProductsModule } from "./products/products.module";
import { PromocodesModule } from "./promocodes/promocodes.module";
import { SeoModule } from "./seo/seo.module";
import { UsersModule } from "./users/users.module";
import { WorkshopsModule } from "./workshops/workshops.module";
import { MaterialsModule } from "./materials/materials.module";

@Module({
  imports: [
    PrismaModule,
    CronModule,
    AchievementsModule,
    AffiliateModule,
    AnalyticsModule,
    UsersModule,
    AuthModule,
    ConsentsModule,
    CartModule,
    OrdersModule,
    LoyaltyHttpModule,
    ProductsModule,
    PromocodesModule,
    CatalogLandingsModule,
    ColoringsModule,
    MaterialsModule,
    BlogModule,
    OzonModule,
    DeliveryModule,
    ContactsModule,
    PartnerApplicationsModule,
    SeoModule,
    ContentAssistantModule,
    FeatureBannersModule,
    WorkshopsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityHeadersMiddleware, CsrfMiddleware).forRoutes("*");
  }
}
