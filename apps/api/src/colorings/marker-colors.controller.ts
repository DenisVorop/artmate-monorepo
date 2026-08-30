import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import { AdminColoringsGuard } from "./admin-colorings.guard";
import { MarkerColorDTO } from "./dto";
import { MarkerColorsService } from "./marker-colors.service";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Marker colors")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "Admin role required" })
@UseGuards(AuthGuard, AdminColoringsGuard)
@Controller("admin/marker-colors")
export class AdminMarkerColorsController {
  constructor(
    private readonly markerColorsService: MarkerColorsService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(MarkerColorDTO, { isArray: true })
  @ApiOperation({ summary: "List Artmate marker colors" })
  @ApiOkResponse({ type: [MarkerColorDTO] })
  @Get()
  getMarkerColors(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.markerColorsService.getMarkerColors();
  }
}
