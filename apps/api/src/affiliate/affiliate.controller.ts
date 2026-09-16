import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  AffiliateContractRevisionDTO,
  AffiliatePartnerDTO,
  AffiliatePartnerListDTO,
  ListAffiliatePartnersQueryDTO,
  PutAffiliatePartnerRequestDTO,
} from "./dto";
import { AffiliateService } from "./affiliate.service";

type AuthenticatedRequest = { user: AuthUser };

@ApiTags("Affiliate")
@UseGuards(AuthGuard)
@Controller("affiliate")
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @ValidateResponse(AffiliatePartnerDTO)
  @ApiOperation({ summary: "Get the current active affiliate partner profile" })
  @ApiOkResponse({ type: AffiliatePartnerDTO })
  @Header("Cache-Control", "private, no-store")
  @Get("me")
  getCurrentPartner(@Req() request: AuthenticatedRequest) {
    return this.affiliateService.getCurrentPartner(request.user);
  }
}

@ApiTags("Affiliate admin")
@UseGuards(AuthGuard)
@Controller("affiliate/admin/partners")
export class AdminAffiliateController {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(AffiliatePartnerListDTO)
  @ApiOperation({ summary: "List affiliate partners" })
  @ApiOkResponse({ type: AffiliatePartnerListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  listPartners(
    @Query() query: ListAffiliatePartnersQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateService.listPartners(query);
  }

  @ValidateResponse(AffiliatePartnerDTO)
  @ApiOperation({ summary: "Get an affiliate partner" })
  @ApiOkResponse({ type: AffiliatePartnerDTO })
  @Header("Cache-Control", "private, no-store")
  @Get(":userId")
  getPartner(
    @Param("userId") userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateService.getPartner(userId);
  }

  @ValidateResponse(AffiliatePartnerDTO)
  @ApiOperation({ summary: "Create or update an affiliate partner" })
  @ApiOkResponse({ type: AffiliatePartnerDTO })
  @Header("Cache-Control", "private, no-store")
  @Put(":userId")
  putPartner(
    @Param("userId") userId: string,
    @Body() body: PutAffiliatePartnerRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateService.putPartner(userId, body, request.user);
  }

  @ValidateResponse(AffiliateContractRevisionDTO, { isArray: true })
  @ApiOperation({ summary: "Get affiliate contract revision history" })
  @ApiOkResponse({ type: [AffiliateContractRevisionDTO] })
  @Header("Cache-Control", "private, no-store")
  @Get(":userId/history")
  getContractHistory(
    @Param("userId") userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateService.getContractHistory(userId);
  }
}
