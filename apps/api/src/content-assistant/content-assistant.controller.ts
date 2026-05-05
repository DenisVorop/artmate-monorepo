import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
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

import { ContentAssistantService } from "./content-assistant.service";
import {
  AiBlogDraftRunDTO,
  StartAiBlogDraftRunRequestDTO,
  TelegramUpdateDTO,
} from "./dto";

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Content assistant")
@UseGuards(AuthGuard)
@Controller("content-assistant/admin")
export class AdminContentAssistantController {
  constructor(
    private readonly contentAssistantService: ContentAssistantService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(AiBlogDraftRunDTO, { isArray: true })
  @ApiOperation({ summary: "List AI blog draft runs" })
  @ApiOkResponse({ type: [AiBlogDraftRunDTO] })
  @Get("blog-draft-runs")
  listBlogDraftRuns(@Req() request: AuthenticatedRequest) {
    this.usersService.assertRole(request.user, "admin");

    return this.contentAssistantService.listBlogDraftRuns();
  }

  @ValidateResponse(AiBlogDraftRunDTO)
  @ApiOperation({ summary: "Start AI blog draft run" })
  @ApiCreatedResponse({ type: AiBlogDraftRunDTO })
  @Post("blog-draft-runs")
  startBlogDraftRun(
    @Body() body: StartAiBlogDraftRunRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.contentAssistantService.startBlogDraftRun(
      body,
      request.user.id,
    );
  }
}

@ApiTags("Content assistant")
@Controller("content-assistant/telegram")
export class TelegramContentAssistantController {
  constructor(
    private readonly contentAssistantService: ContentAssistantService,
  ) {}

  @ApiOperation({ summary: "Handle Telegram content assistant webhook" })
  @ApiOkResponse()
  @Post("webhook/:secret")
  handleWebhook(
    @Param("secret") secret: string,
    @Body() body: TelegramUpdateDTO,
  ) {
    const configuredSecret =
      process.env.CONTENT_ASSISTANT_TELEGRAM_WEBHOOK_SECRET;

    if (!configuredSecret || secret !== configuredSecret) {
      throw new UnauthorizedException("Invalid Telegram webhook secret");
    }

    return this.contentAssistantService.handleTelegramUpdate(body);
  }
}
