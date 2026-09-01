import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  CreatePartnerApplicationRequestDTO,
  ListPartnerApplicationsQueryDTO,
  PartnerApplicationDTO,
  PartnerApplicationListDTO,
  PartnerApplicationSubmissionResultDTO,
  UpdatePartnerApplicationStatusRequestDTO,
} from "./dto";
import { PartnerApplicationsThrottleService } from "./partner-applications-throttle.service";
import { PartnerApplicationsService } from "./partner-applications.service";

type PublicRequest = {
  headers: {
    "x-forwarded-for"?: string | string[];
    "x-real-ip"?: string | string[];
  };
  ip?: string;
};

type AuthenticatedRequest = {
  user: AuthUser;
};

@ApiTags("Partner applications")
@Controller("partner-applications")
export class PublicPartnerApplicationsController {
  constructor(
    private readonly partnerApplicationsService: PartnerApplicationsService,
    private readonly throttle: PartnerApplicationsThrottleService,
  ) {}

  @ValidateResponse(PartnerApplicationSubmissionResultDTO)
  @ApiOperation({ summary: "Submit a partner program application" })
  @ApiAcceptedResponse({ type: PartnerApplicationSubmissionResultDTO })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  createApplication(
    @Body() body: CreatePartnerApplicationRequestDTO,
    @Req() request: PublicRequest,
  ) {
    this.throttle.assertAllowed({
      email: body.email,
      forwardedFor: this.getHeader(request.headers["x-forwarded-for"]),
      realIp: this.getHeader(request.headers["x-real-ip"]),
      requestIp: request.ip,
    });

    return this.partnerApplicationsService.createApplication(body);
  }

  private getHeader(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}

@ApiTags("Partner applications admin")
@UseGuards(AuthGuard)
@Controller("partner-applications/admin")
export class AdminPartnerApplicationsController {
  constructor(
    private readonly partnerApplicationsService: PartnerApplicationsService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(PartnerApplicationListDTO)
  @ApiOperation({ summary: "List partner applications for admin panel" })
  @ApiOkResponse({ type: PartnerApplicationListDTO })
  @Header("Cache-Control", "private, no-store")
  @Get()
  listApplications(
    @Query() query: ListPartnerApplicationsQueryDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.partnerApplicationsService.listApplications(query);
  }

  @ValidateResponse(PartnerApplicationDTO)
  @ApiOperation({ summary: "Update a partner application status" })
  @ApiOkResponse({ type: PartnerApplicationDTO })
  @Header("Cache-Control", "private, no-store")
  @Patch(":id/status")
  updateStatus(
    @Param("id") applicationId: string,
    @Body() body: UpdatePartnerApplicationStatusRequestDTO,
    @Req() request: AuthenticatedRequest,
  ) {
    this.usersService.assertRole(request.user, "admin");

    return this.partnerApplicationsService.updateStatus(applicationId, body);
  }
}
