import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import {
  EnrollLoyaltyDTO,
  LoyaltyDashboardDTO,
  LoyaltyHistoryDTO,
  LoyaltyHistoryQueryDTO,
  LoyaltyOverviewDTO,
} from "./dto";
import { LoyaltyMembershipService } from "./membership.service";

@ApiTags("Loyalty")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("loyalty")
export class LoyaltyController {
  constructor(private readonly membership: LoyaltyMembershipService) {}

  @Get("me/dashboard")
  @Header("Cache-Control", "private, no-store")
  @ValidateResponse(LoyaltyDashboardDTO)
  @ApiOkResponse({ type: LoyaltyDashboardDTO })
  getDashboard(@Req() request: { user: AuthUser }) {
    return this.membership.getDashboard(request.user.id);
  }

  @Get("me")
  @Header("Cache-Control", "private, no-store")
  @ValidateResponse(LoyaltyOverviewDTO)
  @ApiOkResponse({ type: LoyaltyOverviewDTO })
  getMine(@Req() request: { user: AuthUser }) {
    return this.membership.getMine(request.user.id);
  }

  @Post("enroll")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ValidateResponse(LoyaltyOverviewDTO)
  @ApiOkResponse({ type: LoyaltyOverviewDTO })
  enroll(@Req() request: { user: AuthUser }, @Body() input: EnrollLoyaltyDTO) {
    return this.membership.enroll(request.user.id, input);
  }

  @Get("me/operations")
  @Header("Cache-Control", "private, no-store")
  @ValidateResponse(LoyaltyHistoryDTO)
  @ApiOkResponse({ type: LoyaltyHistoryDTO })
  listOperations(
    @Req() request: { user: AuthUser },
    @Query() query: LoyaltyHistoryQueryDTO,
  ) {
    return this.membership.listOperations(request.user.id, query);
  }
}
