import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import {
  AdminContestsController,
  PublicContestsController,
} from "./contests.controller";
import { ContestsService } from "./contests.service";
import { UserPhotoMediaService } from "../user-photos/user-photo-media.service";
import { ContestPhotoStorageService } from "./contest-photo-storage.service";
import { ContestEntriesService } from "./contest-entries.service";
import { ContestDrawService } from "./contest-draw.service";
import { ContestDrawController } from "./contest-draw.controller";
import {
  ContestAdminGuard,
  ContestEntriesController,
  MyContestEntriesController,
  ContestEntryModerationController,
} from "./contest-entries.controller";
import { ContestLegalController } from "./legal/contest-legal.controller";
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [
    ContestLegalController,
    ContestDrawController,
    AdminContestsController,
    ContestEntriesController,
    MyContestEntriesController,
    ContestEntryModerationController,
    PublicContestsController,
  ],
  providers: [
    ContestDrawService,
    ContestsService,
    UserPhotoMediaService,
    ContestPhotoStorageService,
    ContestEntriesService,
    ContestAdminGuard,
  ],
  exports: [ContestDrawService, ContestEntriesService],
})
export class ContestsModule {}
