import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  Post,
  Query,
  Redirect,
  Req,
  Res,
} from "@nestjs/common";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { FlowRequestEvidence } from "./flow-request-evidence";
import { FlowCookies, type FlowCookieResponse } from "./flow-cookies";
import { YandexFlowCookies } from "./yandex-flow-cookies";
import { YandexCallbackDTO, YandexResultQueryDTO } from "./dto/yandex-flow.dto";
import { YandexFlowService } from "./yandex-flow.service";

@Controller("auth")
export class AuthYandexFlowController {
  constructor(private readonly flows: YandexFlowService) {}

  @Post("flow/yandex/start")
  @Header("Cache-Control", "no-store")
  public async start(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.flows.start(FlowCookies.read(cookie));
    FlowCookies.write(response, result.credentials);
    YandexFlowCookies.write(response, result.state, result.verifier);
    return {
      attemptId: result.attemptId,
      authorizationUrl: result.authorizationUrl,
    };
  }

  @Post("flow/yandex/callback")
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  public async callback(
    @Body() input: YandexCallbackDTO,
    @Headers("cookie") cookie: string | undefined,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.flows.callback(
      FlowCookies.require(cookie),
      input,
      cookie,
      FlowRequestEvidence.from(request),
    );
    YandexFlowCookies.clear(response);
    return result;
  }

  @Get("flow/yandex/result")
  @Header("Cache-Control", "no-store")
  public result(
    @Query() query: YandexResultQueryDTO,
    @Headers("cookie") cookie: string | undefined,
  ) {
    return this.flows.result(FlowCookies.require(cookie), query.attemptId);
  }

  /** The registered API callback relays only to the fixed site callback. Site
   * HttpOnly cookies stay on the site origin; identity exchange is a POST there. */
  @Get("oauth/yandex/callback")
  @Redirect()
  @Header("Cache-Control", "no-store")
  @Header("Referrer-Policy", "no-referrer")
  public relay(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
  ) {
    const target = new URL(
      "/auth/oauth/yandex/callback",
      process.env.SITE_URL ?? "http://localhost:3000",
    );
    if (typeof code === "string" && code.length <= 2048)
      target.searchParams.set("code", code);
    if (typeof state === "string" && state.length <= 128)
      target.searchParams.set("state", state);
    if (typeof error === "string" && error.length <= 128)
      target.searchParams.set("error", error);
    return { url: target.toString() };
  }
}
