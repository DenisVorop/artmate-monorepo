import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";
import {
  AchievementDraftDTO,
  ActivateAchievementDTO,
  ArchiveAchievementDraftDTO,
  CreateAchievementDraftDTO,
  UpdateAchievementDraftDTO,
} from "./achievement-drafts.dto";
import { LoyaltyAchievementDraftsService } from "./achievement-drafts.service";

@ApiTags("Loyalty")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("loyalty/admin/achievements")
export class LoyaltyAchievementDraftsController {
  constructor(
    private readonly achievements: LoyaltyAchievementDraftsService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  @ValidateResponse(AchievementDraftDTO, { isArray: true })
  @ApiOkResponse({ type: [AchievementDraftDTO] })
  list(@Req() request: { user: AuthUser }) {
    this.users.assertRole(request.user, "admin");
    return this.achievements.list();
  }

  @Post()
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ValidateResponse(AchievementDraftDTO)
  @ApiCreatedResponse({ type: AchievementDraftDTO })
  create(
    @Req() request: { user: AuthUser },
    @Body() input: CreateAchievementDraftDTO,
  ) {
    this.users.assertRole(request.user, "admin");
    return this.achievements.create(request.user.id, input);
  }

  @Patch(":id")
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ValidateResponse(AchievementDraftDTO)
  @ApiOkResponse({ type: AchievementDraftDTO })
  update(
    @Req() request: { user: AuthUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: UpdateAchievementDraftDTO,
  ) {
    this.users.assertRole(request.user, "admin");
    return this.achievements.update(id, request.user.id, input);
  }

  @Post(":id/activate")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ValidateResponse(AchievementDraftDTO)
  @ApiOkResponse({ type: AchievementDraftDTO })
  activate(
    @Req() request: { user: AuthUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: ActivateAchievementDTO,
  ) {
    this.users.assertRole(request.user, "admin");
    return this.achievements.activate(
      id,
      request.user.id,
      input.expectedVersion,
    );
  }

  @Post(":id/archive")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  @ApiHeader({
    name: "x-artmate-csrf",
    required: true,
    schema: { enum: ["1"] },
  })
  @ValidateResponse(AchievementDraftDTO)
  @ApiOkResponse({ type: AchievementDraftDTO })
  archive(
    @Req() request: { user: AuthUser },
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() input: ArchiveAchievementDraftDTO,
  ) {
    this.users.assertRole(request.user, "admin");
    return this.achievements.archive(id, input.expectedVersion);
  }
}
