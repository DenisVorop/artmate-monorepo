import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { FlowRequestEvidence } from "./flow-request-evidence";
import { PasswordFlowService } from "./password-flow.service";
import { RegistrationCodeService } from "./registration-code.service";
import { ProfileDraftService } from "./profile-draft.service";
import { ProfileDraftDTO } from "./dto/profile-draft.dto";
import { RegistrationDraftService } from "./registration-draft.service";
import { FlowLifecycleService } from "./flow-lifecycle.service";
import { LoginRequestDTO } from "./dto/login-request.dto";
import {
  ConfirmRegistrationCodeDTO,
  RegistrationDraftDTO,
  RequestRegistrationCodeDTO,
} from "./dto/registration-flow-request.dto";
import { FlowCookies, type FlowCookieResponse } from "./flow-cookies";

@Controller("auth")
export class AuthFlowController {
  constructor(
    private readonly passwords: PasswordFlowService,
    private readonly codes: RegistrationCodeService,
    private readonly drafts: RegistrationDraftService,
    private readonly lifecycle: FlowLifecycleService,
    private readonly profiles: ProfileDraftService,
  ) {}

  @Post("flow/password")
  @Header("Cache-Control", "no-store")
  public async password(
    @Body() input: LoginRequestDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.passwords.start(
      input,
      FlowRequestEvidence.from(request),
      FlowCookies.read(cookie),
    );
    FlowCookies.write(response, result.credentials);
    return result.state;
  }

  @Post("email-code/request")
  @Header("Cache-Control", "no-store")
  public async requestCode(
    @Body() input: RequestRegistrationCodeDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.codes.request(
      input.email,
      FlowRequestEvidence.from(request),
      FlowCookies.read(cookie)?.browser,
    );
    FlowCookies.write(response, result.credentials);
    return result.state;
  }

  @Post("email-code/confirm")
  @Header("Cache-Control", "no-store")
  public async confirmCode(
    @Body() input: ConfirmRegistrationCodeDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const credentials = FlowCookies.require(cookie);
    const state = await this.codes.confirm(
      credentials,
      input,
      FlowRequestEvidence.from(request),
    );
    FlowCookies.write(response, credentials);
    return state;
  }

  @Post("email-code/resend")
  @Header("Cache-Control", "no-store")
  public resendCode(@Headers("cookie") cookie?: string) {
    return this.codes.resend(FlowCookies.require(cookie));
  }

  @Post("flow/registration")
  @Header("Cache-Control", "no-store")
  public registration(
    @Body() input: RegistrationDraftDTO,
    @Headers("cookie") cookie?: string,
  ) {
    return this.drafts.save(FlowCookies.require(cookie), input);
  }

  @Post("flow/profile")
  @Header("Cache-Control", "no-store")
  public profile(
    @Body() input: ProfileDraftDTO,
    @Headers("cookie") cookie?: string,
  ) {
    return this.profiles.save(FlowCookies.require(cookie), input);
  }

  @Get("flow")
  @Header("Cache-Control", "no-store")
  public state(@Headers("cookie") cookie?: string) {
    return this.lifecycle.read(FlowCookies.require(cookie));
  }

  @Post("flow/cancel")
  @Header("Cache-Control", "no-store")
  public async cancel(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const credentials = FlowCookies.require(cookie);
    await this.lifecycle.cancel(credentials);
    FlowCookies.clear(response);
    return { status: "CANCELLED" as const };
  }
}
