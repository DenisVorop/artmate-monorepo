import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminFeatureBannersController,
  PublicFeatureBannersController,
} from "./feature-banners.controller";
import { FeatureBannersService } from "./feature-banners.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PublicFeatureBannersController, AdminFeatureBannersController],
  providers: [FeatureBannersService],
  exports: [FeatureBannersService],
})
export class FeatureBannersModule {}
