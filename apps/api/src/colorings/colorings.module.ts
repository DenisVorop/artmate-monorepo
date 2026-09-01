import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";

import { AdminColoringsController } from "./colorings.controller";
import { AdminMarkerColorsController } from "./marker-colors.controller";
import { ColoringsService } from "./colorings.service";
import { AdminColoringsGuard } from "./admin-colorings.guard";
import { AdminColoringCollectionsController } from "./coloring-collections.controller";
import { ColoringCollectionCoverService } from "./coloring-collection-cover.service";
import { ColoringCollectionsService } from "./coloring-collections.service";
import { ColoringMediaService } from "./coloring-media.service";
import { ColoringRevisionsService } from "./coloring-revisions.service";
import { ColoringStorageService } from "./coloring-storage.service";
import { PublicColoringsController } from "./public-colorings.controller";
import { PublicColoringsService } from "./public-colorings.service";
import { PublicColoringCollectionsController } from "./public-coloring-collections.controller";
import { PublicColoringCollectionsService } from "./public-coloring-collections.service";
import { MarkerColorsService } from "./marker-colors.service";

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [
    AdminColoringCollectionsController,
    AdminColoringsController,
    AdminMarkerColorsController,
    PublicColoringCollectionsController,
    PublicColoringsController,
  ],
  providers: [
    AdminColoringsGuard,
    ColoringCollectionCoverService,
    ColoringMediaService,
    ColoringCollectionsService,
    ColoringRevisionsService,
    ColoringStorageService,
    ColoringsService,
    MarkerColorsService,
    PublicColoringsService,
    PublicColoringCollectionsService,
  ],
  exports: [ColoringCollectionsService, ColoringStorageService, ColoringsService],
})
export class ColoringsModule {}
