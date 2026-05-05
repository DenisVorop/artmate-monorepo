import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  CreateSeoEntryRequestDTO,
  PublishSeoEntryRequestDTO,
  RollbackSeoEntryRequestDTO,
  SeoEntryDTO,
  SeoResolvedMetadataDTO,
  SeoSnapshotDTO,
  UpdateSeoEntryRequestDTO,
} from "./dto";
import { SeoService } from "./seo.service";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("SEO")
@Controller("seo")
export class PublicSeoController {
  constructor(private readonly seoService: SeoService) {}

  @ValidateResponse(SeoResolvedMetadataDTO)
  @ApiOperation({ summary: "Resolve published SEO metadata by path" })
  @ApiQuery({ name: "path", required: true })
  @ApiOkResponse({ type: SeoResolvedMetadataDTO })
  @Get("resolve")
  resolve(@Query("path") path: string) {
    return this.seoService.resolve(path);
  }
}

@ApiTags("SEO")
@UseGuards(AuthGuard)
@Controller("seo/admin")
export class AdminSeoController {
  constructor(
    private readonly seoService: SeoService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(SeoEntryDTO, { isArray: true })
  @ApiOperation({ summary: "List SEO entries for admin panel" })
  @ApiOkResponse({ type: [SeoEntryDTO] })
  @Get("entries")
  getEntries(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.getEntries();
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Get SEO entry for admin panel" })
  @ApiOkResponse({ type: SeoEntryDTO })
  @Get("entries/:id")
  getEntry(@Param("id") entryId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.getEntry(entryId);
  }

  @ValidateResponse(SeoSnapshotDTO, { isArray: true })
  @ApiOperation({ summary: "List SEO entry snapshots for admin panel" })
  @ApiOkResponse({ type: [SeoSnapshotDTO] })
  @Get("entries/:id/snapshots")
  getSnapshots(
    @Param("id") entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.getSnapshots(entryId);
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Create SEO entry from admin panel" })
  @ApiCreatedResponse({ type: SeoEntryDTO })
  @Post("entries")
  createEntry(
    @Body() body: CreateSeoEntryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.createEntry(body, request.user.id);
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Update SEO entry draft from admin panel" })
  @ApiOkResponse({ type: SeoEntryDTO })
  @Patch("entries/:id")
  updateEntry(
    @Param("id") entryId: string,
    @Body() body: UpdateSeoEntryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.updateEntry(entryId, body, request.user.id);
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Publish SEO entry from admin panel" })
  @ApiOkResponse({ type: SeoEntryDTO })
  @Post("entries/:id/publish")
  publishEntry(
    @Param("id") entryId: string,
    @Body() body: PublishSeoEntryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.publishEntry(entryId, body, request.user.id);
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Create SEO draft from historical snapshot" })
  @ApiOkResponse({ type: SeoEntryDTO })
  @Post("entries/:id/rollback")
  rollbackEntry(
    @Param("id") entryId: string,
    @Body() body: RollbackSeoEntryRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.rollbackEntry(entryId, body, request.user.id);
  }

  @ValidateResponse(SeoEntryDTO)
  @ApiOperation({ summary: "Delete SEO entry from admin panel" })
  @ApiOkResponse({ type: SeoEntryDTO })
  @Delete("entries/:id")
  deleteEntry(
    @Param("id") entryId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.seoService.deleteEntry(entryId);
  }
}
