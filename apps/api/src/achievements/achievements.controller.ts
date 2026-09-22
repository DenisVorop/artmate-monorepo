import { Controller, Get, Header, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { AchievementsDTO } from "./dto";
import { AchievementsService } from "./achievements.service";

@ApiTags("Achievements")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("achievements")
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get("me")
  @Header("Cache-Control", "private, no-store")
  @ValidateResponse(AchievementsDTO)
  @ApiOkResponse({ type: AchievementsDTO })
  getMine(@Req() request: { user: AuthUser }) {
    return this.achievements.getMine(request.user.id);
  }
}
