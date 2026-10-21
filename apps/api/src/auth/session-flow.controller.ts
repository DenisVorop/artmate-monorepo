import { Controller, Header, Headers, Post, Req, Res } from "@nestjs/common";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { FlowRequestEvidence } from "./flow-request-evidence";
import { FlowCookies, type FlowCookieResponse } from "./flow-cookies";
import { SessionFlowService } from "./session-flow.service";

@Controller("auth/flow")
export class AuthSessionFlowController {
  constructor(private readonly sessions: SessionFlowService) {}

  @Post("start")
  @Header("Cache-Control", "no-store")
  public async start(
    @Headers("cookie") cookie: string | undefined,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.sessions.start(
      cookie,
      FlowRequestEvidence.from(request),
      FlowCookies.read(cookie),
    );
    if (!result)
      return { status: "LOGIN_REQUIRED" as const, nextStep: "login" as const };
    FlowCookies.write(response, result.credentials);
    return result.state;
  }
}
