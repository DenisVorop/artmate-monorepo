import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { blogLikeSubjects } from "../blog/contracts/like-subjects.contract";
import { workshopLikeSubjects } from "../workshops/contracts/like-subjects.contract";
import { LikesCleanupService } from "./cleanup.service";
import { likeSubjectPublications } from "./contracts";
import { LikesController } from "./likes.controller";
import { LikesService } from "./likes.service";
import { OptionalLikeAuthGuard } from "./optional-auth.guard";
import { LikeSubjectRegistry } from "./subject-registry";

@Module({
  imports: [AuthModule],
  controllers: [LikesController],
  providers: [
    {
      provide: likeSubjectPublications,
      useValue: [workshopLikeSubjects, blogLikeSubjects],
    },
    LikeSubjectRegistry,
    LikesService,
    LikesCleanupService,
    OptionalLikeAuthGuard,
  ],
  exports: [LikesService, LikesCleanupService],
})
export class LikesModule {}
