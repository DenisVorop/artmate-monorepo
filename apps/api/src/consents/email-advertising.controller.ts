import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UnsupportedMediaTypeException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { NoFilesInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthUser } from "../auth/auth.types";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { RequestEvidenceCapture } from "../common/request-evidence-capture";
import { TrustedProxyEvidence } from "../common/trusted-proxy-evidence";
import { ValidateResponse } from "../common/response-validation.interceptor";
import { EmailAdvertisingSettingsGrantService } from "./email-advertising-settings-grant.service";
import { EmailAdvertisingService } from "./email-advertising.service";
import {
  EmailAdvertisingStatusDTO,
  GrantEmailAdvertisingDTO,
  UnsubscribeConfirmDTO,
  UnsubscribeOneClickDTO,
  UnsubscribeQueryDTO,
  UnsubscribeResultDTO,
} from "./dto/email-advertising.dto";

type AccountRequest = EvidenceRequest & {
  readonly user: AuthUser;
  readonly body?: unknown;
};

@Controller("consents/email-advertising")
export class EmailAdvertisingController {
  constructor(
    private readonly advertising: EmailAdvertisingService,
    private readonly settingsGrant: EmailAdvertisingSettingsGrantService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "no-store")
  @ValidateResponse(EmailAdvertisingStatusDTO)
  public read(@Req() request: AccountRequest) {
    return this.advertising.read(this._email(request));
  }

  @Post("grant")
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "no-store")
  @ValidateResponse(EmailAdvertisingStatusDTO)
  public grant(
    @Body() input: GrantEmailAdvertisingDTO,
    @Req() request: AccountRequest,
  ) {
    return this.settingsGrant.grant(
      request.user,
      input,
      TrustedProxyEvidence.from(
        request,
        process.env.AUTH_FLOW_PROXY_SECRET?.trim(),
      ),
    );
  }

  @Post("revoke")
  @UseGuards(AuthGuard)
  @Header("Cache-Control", "no-store")
  @ValidateResponse(EmailAdvertisingStatusDTO)
  public revoke(@Body() input: unknown, @Req() request: AccountRequest) {
    if (
      input !== undefined &&
      (!input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).length)
    )
      throw new BadRequestException("Request body must be empty");
    return this.advertising.revoke(this._email(request), {
      actorUserId: request.user.id,
      source: "notification_settings",
      context: TrustedProxyEvidence.from(
        request,
        process.env.AUTH_FLOW_PROXY_SECRET?.trim(),
      ),
    });
  }

  @Get("unsubscribe")
  public open(
    @Query() input: UnsubscribeQueryDTO,
    @Res() response: { redirect(status: number, url: string): void },
  ) {
    const url = new URL(
      "/unsubscribe",
      process.env.SITE_URL?.trim() || "http://localhost:3000",
    );
    if (!["http:", "https:"].includes(url.protocol))
      throw new BadRequestException("Unsubscribe page is unavailable");
    url.searchParams.set("token", input.token);
    response.redirect(303, url.toString());
  }

  @Post("unsubscribe")
  @UseInterceptors(
    NoFilesInterceptor({
      limits: {
        fields: 1,
        files: 0,
        parts: 2,
        fieldSize: 32,
        fieldNameSize: 32,
      },
    }),
  )
  @ValidateResponse(UnsubscribeResultDTO)
  public async oneClick(
    @Body() _input: UnsubscribeOneClickDTO,
    @Headers("content-type") contentType: string | undefined,
    @Query() query: UnsubscribeQueryDTO,
    @Req() request: EvidenceRequest,
  ) {
    const type = contentType?.split(";")[0]?.trim().toLowerCase();
    if (
      type !== "application/x-www-form-urlencoded" &&
      type !== "multipart/form-data"
    )
      throw new UnsupportedMediaTypeException(
        "A standard unsubscribe form is required",
      );
    await this.advertising.unsubscribe(query.token, {
      source: "email_one_click",
      context: RequestEvidenceCapture.from(request),
    });
    return { unsubscribed: true as const };
  }

  @Post("unsubscribe/confirm")
  @ValidateResponse(UnsubscribeResultDTO)
  public async confirm(
    @Body() input: UnsubscribeConfirmDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
  ) {
    await this.advertising.unsubscribe(input.token, {
      source: "email_unsubscribe",
      context: TrustedProxyEvidence.from(
        request,
        process.env.AUTH_FLOW_PROXY_SECRET?.trim(),
      ),
    });
    return { unsubscribed: true as const };
  }

  private _email(request: AccountRequest): string {
    if (!request.user.email)
      throw new UnauthorizedException("Account email is unavailable");
    return request.user.email;
  }
}
