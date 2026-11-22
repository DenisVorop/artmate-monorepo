import {
  Body,
  Controller,
  Get,
  Header,
  Injectable,
  Param,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { type EvidenceRequest } from "../common/request-evidence-capture";
import { TrustedProxyEvidence } from "../common/trusted-proxy-evidence";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsString, MaxLength } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { SiteActionGuard } from "../auth/site-action.guard";
import { RequireSiteAction } from "../auth/require-site-action";
import type { SiteActionRequest } from "../auth/contracts/site-action-access.contract";
import { UsersService } from "../users/users.service";
import type { UserPhotoUpload } from "../user-photos/user-photo-media.service";
import { ContestEntriesService } from "./contest-entries.service";
import { ContestEntryDecisionDTO } from "./dto/contest-entry-request.dto";

@Injectable()
export class ContestAdminGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}
  canActivate(context: ExecutionContext) {
    this.users.assertRole(
      context.switchToHttp().getRequest<{ user: AuthUser }>().user,
      "admin",
    );
    return true;
  }
}
class EntryMultipartDTO {
  @IsString()
  @MaxLength(10000)
  payload!: string;
}
const photo = (bytes: Buffer) =>
  new StreamableFile(bytes, { type: "image/webp", length: bytes.length });

@Controller("contests")
export class ContestEntriesController {
  constructor(private readonly entries: ContestEntriesService) {}
  @Get(":slug/entry")
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "private, no-store")
  async mine(@Param("slug") slug: string, @Req() req: { user: AuthUser }) {
    return { entry: await this.entries.mine(slug, req.user.id) };
  }
  @Post(":slug/entry-consent")
  @RequireSiteAction("contest_entry")
  @UseGuards(SiteActionGuard)
  @Header("Cache-Control", "private, no-store")
  prepareConsent(@Param("slug") slug: string, @Req() req: SiteActionRequest) {
    return this.entries.prepareConsent(slug, req.siteAction.actor.userId);
  }
  @Post(":slug/entry")
  @RequireSiteAction("contest_entry")
  @UseGuards(SiteActionGuard)
  @Header("Cache-Control", "private, no-store")
  @UseInterceptors(
    FileInterceptor("photo", {
      limits: {
        fileSize: 10 * 1024 * 1024,
        fields: 1,
        files: 1,
        parts: 3,
        fieldSize: 10000,
      },
    }),
  )
  submit(
    @Param("slug") slug: string,
    @Req()
    req: SiteActionRequest & EvidenceRequest & { readonly body?: unknown },
    @Body() body: EntryMultipartDTO,
    @UploadedFile() file?: UserPhotoUpload,
  ) {
    return this.entries.submit(
      slug,
      req.siteAction.actor.userId,
      body.payload,
      file,
      TrustedProxyEvidence.from(
        req,
        process.env.AUTH_FLOW_PROXY_SECRET?.trim(),
      ),
    );
  }
  @Get("works/:publicId/photo/:variant")
  @Header("Cache-Control", "private, no-store")
  @Header("Content-Type", "image/webp")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("X-Robots-Tag", "noindex, noimageindex")
  async publicPhoto(
    @Param("publicId") publicId: string,
    @Param("variant") variant: string,
  ) {
    return photo(await this.entries.publicPhoto(publicId, variant));
  }
}
@Controller("contest-entries/me")
@UseGuards(AuthGuard)
export class MyContestEntriesController {
  constructor(private readonly entries: ContestEntriesService) {}
  @Get(":id/revisions/:revisionId/photo")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("X-Robots-Tag", "noindex, noimageindex")
  async ownerPhoto(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
    @Req() req: { user: AuthUser },
  ) {
    return photo(await this.entries.ownerPhoto(id, revisionId, req.user.id));
  }
}
@Controller("admin")
@UseGuards(AuthGuard, ContestAdminGuard)
export class ContestEntryModerationController {
  constructor(private readonly entries: ContestEntriesService) {}
  @Get("contests/:id/entries")
  @Header("Cache-Control", "private, no-store")
  list(
    @Param("id") id: string,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
  ) {
    return this.entries.list(id, status, cursor);
  }
  @Get("contest-entries/:id")
  @Header("Cache-Control", "private, no-store")
  detail(@Param("id") id: string) {
    return this.entries.detail(id);
  }
  @Post("contest-entries/:id/decision")
  @Header("Cache-Control", "private, no-store")
  decide(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
    @Body() body: ContestEntryDecisionDTO,
  ) {
    return this.entries.decide(id, req.user.id, body);
  }
  @Get("contest-entries/:id/revisions/:revisionId/photo")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("X-Robots-Tag", "noindex, noimageindex")
  async photo(
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ) {
    return photo(await this.entries.adminPhoto(id, revisionId));
  }
}
