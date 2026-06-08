import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import {
  AdminCatalogLandingsController,
  PublicCatalogLandingsController,
} from "./catalog-landings.controller";
import { CatalogLandingsService } from "./catalog-landings.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PublicCatalogLandingsController, AdminCatalogLandingsController],
  providers: [CatalogLandingsService],
  exports: [CatalogLandingsService],
})
export class CatalogLandingsModule {}
