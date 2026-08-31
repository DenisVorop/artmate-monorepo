import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { AuthGuard } from "../auth/auth.guard";
import { AuthService } from "../auth/auth.service";
import type { AuthUser } from "../auth/auth.types";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { UsersService } from "../users/users.service";

import {
  PromoCodeAdminDTO,
  PromoCodeInputDTO,
  PromoCodeRequestDTO,
  PromoPreviewDTO,
  ReleasePromoRedemptionDTO,
  UpdatePromoCodeInputDTO,
} from "./dto";
import { PromocodesThrottleService } from "./promocodes-throttle.service";
import { PromocodesService } from "./promocodes.service";

type HttpRequest = {
  headers: {
    authorization?: string;
    cookie?: string;
    "x-forwarded-for"?: string;
    "x-real-ip"?: string;
  };
  ip?: string;
  user?: AuthUser;
};

@ApiTags("Promocodes")
@Controller("promocodes")
export class PublicPromocodesController {
  constructor(
    private readonly promocodesService: PromocodesService,
    private readonly throttle: PromocodesThrottleService,
    private readonly authService: AuthService,
  ) {}

  @ValidateResponse(PromoPreviewDTO)
  @ApiOkResponse({ type: PromoPreviewDTO })
  @HttpCode(HttpStatus.OK)
  @Post("preview")
  async preview(
    @Body() body: PromoCodeRequestDTO,
    @Req() request: HttpRequest,
  ) {
    this.assertRateLimit(request);
    const token = this.authService.getTokenFromRequest(
      request.headers.authorization,
      request.headers.cookie,
    );
    const user = token
      ? await this.authService.verifyAccessToken(token)
      : undefined;
    return this.promocodesService.preview({
      code: body.code,
      cartId: this.throttle.getCookie(request.headers.cookie, "cart_id"),
      userId: user?.id,
    });
  }

  private assertRateLimit(request: HttpRequest) {
    this.throttle.assertAllowed({
      cookieHeader: request.headers.cookie,
      forwardedFor: request.headers["x-forwarded-for"],
      realIp: request.headers["x-real-ip"],
      requestIp: request.ip,
    });
  }
}

@ApiTags("Promocodes admin")
@UseGuards(AuthGuard)
@Controller("promocodes/admin")
export class AdminPromocodesController {
  constructor(
    private readonly promocodesService: PromocodesService,
    private readonly usersService: UsersService,
  ) {}

  @ValidateResponse(PromoCodeAdminDTO, { isArray: true })
  @ApiOkResponse({ type: [PromoCodeAdminDTO] })
  @Get()
  list(@Req() request: HttpRequest) {
    this.assertAdmin(request);
    return this.promocodesService.listAdmin();
  }

  @ValidateResponse(PromoCodeAdminDTO)
  @ApiCreatedResponse({ type: PromoCodeAdminDTO })
  @Post()
  create(@Body() body: PromoCodeInputDTO, @Req() request: HttpRequest) {
    this.assertAdmin(request);
    return this.promocodesService.createAdmin(body);
  }

  @ValidateResponse(PromoCodeAdminDTO)
  @ApiOkResponse({ type: PromoCodeAdminDTO })
  @Get(":id")
  get(@Param("id") id: string, @Req() request: HttpRequest) {
    this.assertAdmin(request);
    return this.promocodesService.getAdmin(id);
  }

  @ValidateResponse(PromoCodeAdminDTO)
  @ApiOkResponse({ type: PromoCodeAdminDTO })
  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() body: UpdatePromoCodeInputDTO,
    @Req() request: HttpRequest,
  ) {
    this.assertAdmin(request);
    return this.promocodesService.updateAdmin(id, body);
  }

  @ValidateResponse(PromoCodeAdminDTO)
  @ApiOkResponse({ type: PromoCodeAdminDTO })
  @HttpCode(HttpStatus.OK)
  @Post(":id/redemptions/:orderId/release")
  release(
    @Param("id") id: string,
    @Param("orderId") orderId: string,
    @Body() body: ReleasePromoRedemptionDTO,
    @Req() request: HttpRequest,
  ) {
    this.assertAdmin(request);
    return this.promocodesService.releaseByAdmin({
      promoCodeId: id,
      orderId,
      actorId: request.user!.id,
      confirmation: body.confirmation,
      reason: body.reason,
    });
  }

  private assertAdmin(request: HttpRequest) {
    this.usersService.assertRole(request.user!, "admin");
  }
}
