import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import { AdminSeoController, PublicSeoController } from "./seo.controller";
import { SeoService } from "./seo.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PublicSeoController, AdminSeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
