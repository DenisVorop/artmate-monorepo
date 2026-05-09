import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  CreateFeatureBannerRequestDTO,
  FeatureBannerDTO,
  UpdateFeatureBannerRequestDTO,
} from "./dto";
import { FeatureBannersService } from "./feature-banners.service";

type RequestWithHeaders = {
  headers: {
    authorization?: string;
    cookie?: string;
  };
};

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Feature banners")
@Controller("feature-banners")
export class PublicFeatureBannersController {
  constructor(
    private readonly authService: AuthService,
    private readonly featureBannersService: FeatureBannersService,
  ) {}

  @ValidateResponse(FeatureBannerDTO, { isArray: true })
  @ApiOperation({ summary: "List visible feature banners" })
  @ApiOkResponse({ type: [FeatureBannerDTO] })
  @Get()
  async getVisibleBanners(@Req() request: RequestWithHeaders) {
    const session = await this.authService.getSession(
      request.headers.authorization,
      request.headers.cookie,
    );

    return this.featureBannersService.getVisibleBanners(session.user);
  }
}

@ApiTags("Feature banners")
@UseGuards(AuthGuard)
@Controller("feature-banners/admin")
export class AdminFeatureBannersController {
  constructor(
    private readonly featureBannersService: FeatureBannersService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(FeatureBannerDTO, { isArray: true })
  @ApiOperation({ summary: "List feature banners for admin panel" })
  @ApiOkResponse({ type: [FeatureBannerDTO] })
  @Get()
  getAdminBanners(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.featureBannersService.getAdminBanners();
  }

  @ValidateResponse(FeatureBannerDTO)
  @ApiOperation({ summary: "Create feature banner from admin panel" })
  @ApiCreatedResponse({ type: FeatureBannerDTO })
  @Post()
  createBanner(
    @Body() body: CreateFeatureBannerRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.featureBannersService.createBanner(body);
  }

  @ValidateResponse(FeatureBannerDTO)
  @ApiOperation({ summary: "Update feature banner from admin panel" })
  @ApiOkResponse({ type: FeatureBannerDTO })
  @Patch(":id")
  updateBanner(
    @Param("id") bannerId: string,
    @Body() body: UpdateFeatureBannerRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.featureBannersService.updateBanner(bannerId, body);
  }

  @ValidateResponse(FeatureBannerDTO)
  @ApiOperation({ summary: "Archive feature banner from admin panel" })
  @ApiOkResponse({ type: FeatureBannerDTO })
  @Delete(":id")
  archiveBanner(
    @Param("id") bannerId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.featureBannersService.archiveBanner(bannerId);
  }
}
