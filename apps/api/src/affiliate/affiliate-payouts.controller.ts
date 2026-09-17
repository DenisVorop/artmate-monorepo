import { Body, Controller, Get, Header, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";
import { AffiliatePayoutsService } from "./affiliate-payouts.service";
import {
  AffiliatePayoutDTO,
  AffiliatePayoutListDTO,
  AffiliatePayoutQueryDTO,
  CreateAffiliatePayoutRequestDTO,
  MarkAffiliatePayoutPaidRequestDTO,
  RejectAffiliatePayoutRequestDTO,
} from "./dto";

type AuthenticatedRequest = { user: AuthUser };

@ApiTags("Affiliate payouts")
@UseGuards(AuthGuard)
@Controller("affiliate/payouts")
export class AffiliatePayoutsController {
  constructor(private readonly payouts: AffiliatePayoutsService) {}

  @ValidateResponse(AffiliatePayoutListDTO)
  @ApiOperation({ summary: "List current partner payouts" })
  @ApiOkResponse({ type: AffiliatePayoutListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  list(@Query() query: AffiliatePayoutQueryDTO, @Req() request: AuthenticatedRequest) {
    return this.payouts.listOwnPayouts(request.user, query.page, query.pageSize);
  }

  @ValidateResponse(AffiliatePayoutDTO)
  @ApiOperation({ summary: "Request an affiliate payout" })
  @ApiOkResponse({ type: AffiliatePayoutDTO })
  @Header("Cache-Control", "private, no-store")
  @Post()
  create(@Body() body: CreateAffiliatePayoutRequestDTO, @Req() request: AuthenticatedRequest) {
    return this.payouts.createOwnPayout(request.user, body);
  }
}

@ApiTags("Affiliate payout admin")
@UseGuards(AuthGuard)
@Controller("affiliate/admin/partners/:userId/payouts")
export class AdminAffiliatePayoutsController {
  constructor(
    private readonly payouts: AffiliatePayoutsService,
    private readonly users: UsersService,
  ) {}

  @ValidateResponse(AffiliatePayoutListDTO)
  @ApiOperation({ summary: "List partner payouts" })
  @ApiOkResponse({ type: AffiliatePayoutListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  list(@Param("userId") userId: string, @Query() query: AffiliatePayoutQueryDTO, @Req() request: AuthenticatedRequest) {
    this.users.assertRole(request.user, "admin");
    return this.payouts.listAdminPayouts(userId, query.page, query.pageSize);
  }

  @ValidateResponse(AffiliatePayoutDTO)
  @ApiOperation({ summary: "Record a partner payout as paid" })
  @ApiOkResponse({ type: AffiliatePayoutDTO })
  @Header("Cache-Control", "private, no-store")
  @Post(":payoutId/paid")
  paid(@Param("userId") userId: string, @Param("payoutId") payoutId: string, @Body() body: MarkAffiliatePayoutPaidRequestDTO, @Req() request: AuthenticatedRequest) {
    this.users.assertRole(request.user, "admin");
    return this.payouts.markPaid(userId, payoutId, body, request.user);
  }

  @ValidateResponse(AffiliatePayoutDTO)
  @ApiOperation({ summary: "Reject a partner payout" })
  @ApiOkResponse({ type: AffiliatePayoutDTO })
  @Header("Cache-Control", "private, no-store")
  @Post(":payoutId/reject")
  reject(@Param("userId") userId: string, @Param("payoutId") payoutId: string, @Body() body: RejectAffiliatePayoutRequestDTO, @Req() request: AuthenticatedRequest) {
    this.users.assertRole(request.user, "admin");
    return this.payouts.reject(userId, payoutId, body, request.user);
  }
}
