import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { CatalogLandingsService } from "./catalog-landings.service";
import {
  CatalogLandingPageDTO,
  CreateCatalogLandingPageRequestDTO,
  UpdateCatalogLandingPageRequestDTO,
} from "./dto";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Catalog landings")
@Controller("catalog/landings")
export class PublicCatalogLandingsController {
  constructor(private readonly catalogLandingsService: CatalogLandingsService) {}

  @ValidateResponse(CatalogLandingPageDTO, { isArray: true })
  @ApiOperation({ summary: "List published catalog landing pages" })
  @ApiOkResponse({ type: [CatalogLandingPageDTO] })
  @Get()
  getLandingPages() {
    return this.catalogLandingsService.getPublishedLandingPages();
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Get published catalog landing page by slug" })
  @ApiOkResponse({ type: CatalogLandingPageDTO })
  @Get(":slug")
  getLandingPage(@Param("slug") slug: string) {
    return this.catalogLandingsService.getPublishedLandingPage(slug);
  }
}

@ApiTags("Catalog landings")
@UseGuards(AuthGuard)
@Controller("catalog/admin/landings")
export class AdminCatalogLandingsController {
  constructor(
    private readonly catalogLandingsService: CatalogLandingsService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(CatalogLandingPageDTO, { isArray: true })
  @ApiOperation({ summary: "List catalog landing pages for admin panel" })
  @ApiOkResponse({ type: [CatalogLandingPageDTO] })
  @Get()
  getLandingPages(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.getAdminLandingPages();
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Get catalog landing page for admin panel" })
  @ApiOkResponse({ type: CatalogLandingPageDTO })
  @Get(":id")
  getLandingPage(@Param("id") landingId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.getAdminLandingPage(landingId);
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Create catalog landing page from admin panel" })
  @ApiCreatedResponse({ type: CatalogLandingPageDTO })
  @Post()
  createLandingPage(
    @Body() body: CreateCatalogLandingPageRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.createLandingPage(body);
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Update catalog landing page from admin panel" })
  @ApiOkResponse({ type: CatalogLandingPageDTO })
  @Patch(":id")
  updateLandingPage(
    @Param("id") landingId: string,
    @Body() body: UpdateCatalogLandingPageRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.updateLandingPage(landingId, body);
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Publish catalog landing page from admin panel" })
  @ApiOkResponse({ type: CatalogLandingPageDTO })
  @Post(":id/publish")
  publishLandingPage(@Param("id") landingId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.publishLandingPage(landingId);
  }

  @ValidateResponse(CatalogLandingPageDTO)
  @ApiOperation({ summary: "Delete catalog landing page from admin panel" })
  @ApiOkResponse({ type: CatalogLandingPageDTO })
  @Delete(":id")
  deleteLandingPage(@Param("id") landingId: string, @Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.catalogLandingsService.deleteLandingPage(landingId);
  }
}
