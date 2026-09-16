import {
  Body,
  Controller,
  Get,
  Header,
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
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { AffiliateCodesService } from "./affiliate-codes.service";
import {
  AffiliateCodeDTO,
  AffiliateCodeListDTO,
  CreateAffiliateCodeRequestDTO,
  ListAffiliateCodesQueryDTO,
  UpdateAffiliateCodeRequestDTO,
} from "./dto";

type AuthenticatedRequest = { user: AuthUser };

@ApiTags("Affiliate codes")
@UseGuards(AuthGuard)
@Controller("affiliate/codes")
export class AffiliateCodesController {
  constructor(private readonly affiliateCodesService: AffiliateCodesService) {}

  @ValidateResponse(AffiliateCodeListDTO)
  @ApiOperation({ summary: "List current affiliate partner codes" })
  @ApiOkResponse({ type: AffiliateCodeListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  list(
    @Query() query: ListAffiliateCodesQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.affiliateCodesService.listOwn(request.user, query);
  }

  @ValidateResponse(AffiliateCodeDTO)
  @ApiOperation({ summary: "Create an affiliate code" })
  @ApiCreatedResponse({ type: AffiliateCodeDTO })
  @Header("Cache-Control", "private, no-store")
  @Post()
  create(
    @Body() body: CreateAffiliateCodeRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.affiliateCodesService.createOwn(request.user, body);
  }

  @ValidateResponse(AffiliateCodeDTO)
  @ApiOperation({ summary: "Update an owned affiliate code" })
  @ApiOkResponse({ type: AffiliateCodeDTO })
  @Header("Cache-Control", "private, no-store")
  @Patch(":codeId")
  update(
    @Param("codeId") codeId: string,
    @Body() body: UpdateAffiliateCodeRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.affiliateCodesService.updateOwn(request.user, codeId, body);
  }
}

@ApiTags("Affiliate admin codes")
@UseGuards(AuthGuard)
@Controller("affiliate/admin/partners/:userId/codes")
export class AdminAffiliateCodesController {
  constructor(
    private readonly affiliateCodesService: AffiliateCodesService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(AffiliateCodeListDTO)
  @ApiOperation({ summary: "List an affiliate partner's codes" })
  @ApiOkResponse({ type: AffiliateCodeListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  list(
    @Param("userId") userId: string,
    @Query() query: ListAffiliateCodesQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateCodesService.listAdmin(userId, query);
  }

  @ValidateResponse(AffiliateCodeDTO)
  @ApiOperation({ summary: "Update an affiliate partner's code" })
  @ApiOkResponse({ type: AffiliateCodeDTO })
  @Header("Cache-Control", "private, no-store")
  @Patch(":codeId")
  update(
    @Param("userId") userId: string,
    @Param("codeId") codeId: string,
    @Body() body: UpdateAffiliateCodeRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.affiliateCodesService.updateAdmin(userId, codeId, body);
  }
}
