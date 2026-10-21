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
import { AuthService } from "./auth.service";
import { CompletionSessionCheck } from "./completion-session-check";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { AuthCompletionService } from "./completion.service";
import { CompleteAuthFlowDTO } from "./dto/completion.dto";
import { FlowCookies, type FlowCookieResponse } from "./flow-cookies";
import { FlowRequestEvidence } from "./flow-request-evidence";
import { FlowLifecycleService } from "./flow-lifecycle.service";
import {
  AUTH_ACCESS_TOKEN_COOKIE_NAME,
  AUTH_ACCESS_TOKEN_MAX_AGE_MS,
} from "./auth.constants";

@Controller("auth/flow")
export class AuthCompletionController {
  constructor(
    private readonly completion: AuthCompletionService,
    private readonly lifecycle: FlowLifecycleService,
    private readonly auth: AuthService,
    private readonly sessions: CompletionSessionCheck,
  ) {}

  @Post("complete")
  @Header("Cache-Control", "no-store")
  public async submit(
    @Body() input: CompleteAuthFlowDTO,
    @Headers("cookie") cookie: string | undefined,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const credentials = FlowCookies.require(cookie);
    await this.sessions.assert(credentials, cookie);
    const outcome = await this.completion.submit(
      credentials,
      input,
      FlowRequestEvidence.from(request),
    );
    await this.sessions.assert(credentials, cookie);
    return this._respond(outcome, response);
  }

  @Get("complete")
  @Header("Cache-Control", "no-store")
  public async read(
    @Headers("cookie") cookie: string | undefined,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const credentials = FlowCookies.require(cookie);
    await this.sessions.assert(credentials, cookie);
    const outcome = await this.completion.advance(
      credentials,
      FlowRequestEvidence.from(request),
    );
    await this.sessions.assert(credentials, cookie);
    return outcome
      ? this._respond(outcome, response)
      : this.lifecycle.read(credentials);
  }

  private async _respond(
    outcome: Awaited<ReturnType<AuthCompletionService["submit"]>>,
    response: FlowCookieResponse,
  ) {
    if (outcome.status !== "COMPLETED")
      return outcome.status === "PENDING"
        ? { ...outcome, nextStep: "completion" as const }
        : outcome;
    const { principal } = outcome;
    const token = await this.auth.createAccessToken(principal);
    const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();
    response.cookie(AUTH_ACCESS_TOKEN_COOKIE_NAME, token, {
      ...(domain ? { domain } : {}),
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: AUTH_ACCESS_TOKEN_MAX_AGE_MS,
    });
    const {
      authVersion: _authVersion,
      envCredentialBinding: _binding,
      ...user
    } = principal;
    void _authVersion;
    void _binding;
    // Keep the short-lived bound capability for a lost response replay. It is
    // never itself an access token and the completion rechecks current versions.
    return { status: "COMPLETED" as const, user };
  }
}
