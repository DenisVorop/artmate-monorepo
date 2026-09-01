import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ColoringsModule } from "../colorings/colorings.module";
import { UsersModule } from "../users/users.module";
import { PublicWorkshopService } from "./public-workshop.service";
import { WorkshopAdminGuard } from "./workshop-admin.guard";
import { WorkshopAssetDeletionQueueService } from "./workshop-asset-deletion-queue.service";
import {
  PublicWorkshopController,
  WorkshopController,
  WorkshopModerationController,
} from "./workshop.controller";
import { WorkshopMediaService } from "./workshop-media.service";
import { WorkshopModerationService } from "./workshop-moderation.service";
import { WorkshopStorageService } from "./workshop-storage.service";
import { WorkshopService } from "./workshop.service";

@Module({
  imports: [AuthModule, ColoringsModule, UsersModule],
  controllers: [
    WorkshopController,
    PublicWorkshopController,
    WorkshopModerationController,
  ],
  providers: [
    WorkshopAdminGuard,
    WorkshopMediaService,
    WorkshopStorageService,
    WorkshopAssetDeletionQueueService,
    WorkshopService,
    PublicWorkshopService,
    WorkshopModerationService,
  ],
})
export class WorkshopsModule {}
