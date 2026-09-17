import {
  Controller,
  Get,
  Header,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { AffiliateAnalyticsService } from "./affiliate-analytics.service";
import {
  AffiliateAnalyticsDTO,
  AffiliateAnalyticsQueryDTO,
  AffiliateLedgerDTO,
  AffiliateLedgerQueryDTO,
} from "./dto";

type AuthenticatedRequest = { user: AuthUser };

@ApiTags("Affiliate analytics")
@UseGuards(AuthGuard)
@Controller("affiliate")
export class AffiliateAnalyticsController {
  constructor(private readonly analyticsService: AffiliateAnalyticsService) {}

  @ValidateResponse(AffiliateAnalyticsDTO)
  @ApiOperation({ summary: "Get current affiliate partner analytics" })
  @ApiOkResponse({ type: AffiliateAnalyticsDTO })
  @Header("Cache-Control", "private, no-store")
  @Get("analytics")
  getAnalytics(
    @Query() query: AffiliateAnalyticsQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.analyticsService.getOwnAnalytics(request.user, query);
  }

  @ValidateResponse(AffiliateLedgerDTO)
  @ApiOperation({ summary: "Get current affiliate partner ledger" })
  @ApiOkResponse({ type: AffiliateLedgerDTO })
  @Header("Cache-Control", "private, no-store")
  @Get("ledger")
  getLedger(
    @Query() query: AffiliateLedgerQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.analyticsService.getOwnLedger(request.user, query);
  }
}

@ApiTags("Affiliate admin analytics")
@UseGuards(AuthGuard)
@Controller("affiliate/admin/partners/:userId")
export class AdminAffiliateAnalyticsController {
  constructor(
    private readonly analyticsService: AffiliateAnalyticsService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(AffiliateAnalyticsDTO)
  @ApiOperation({ summary: "Get an affiliate partner's analytics" })
  @ApiOkResponse({ type: AffiliateAnalyticsDTO })
  @Header("Cache-Control", "private, no-store")
  @Get("analytics")
  getAnalytics(
    @Param("userId") userId: string,
    @Query() query: AffiliateAnalyticsQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.analyticsService.getAdminAnalytics(userId, query);
  }

  @ValidateResponse(AffiliateLedgerDTO)
  @ApiOperation({ summary: "Get an affiliate partner's ledger" })
  @ApiOkResponse({ type: AffiliateLedgerDTO })
  @Header("Cache-Control", "private, no-store")
  @Get("ledger")
  getLedger(
    @Param("userId") userId: string,
    @Query() query: AffiliateLedgerQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");
    return this.analyticsService.getAdminLedger(userId, query);
  }
}
