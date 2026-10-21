import {
  Body,
  Controller,
  Header,
  Headers,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { EvidenceRequest } from "../common/request-evidence-capture";
import { ActivationFlowService } from "./activation-flow.service";
import { RecoveryFlowService } from "./recovery-flow.service";
import { FlowLifecycleService } from "./flow-lifecycle.service";
import { RegistrationDraftService } from "./registration-draft.service";
import { FlowCookies, type FlowCookieResponse } from "./flow-cookies";
import { FlowRequestEvidence } from "./flow-request-evidence";
import { RequestRegistrationCodeDTO } from "./dto/registration-flow-request.dto";
import {
  ActivationPasswordDraftDTO,
  ConfirmRecoveryPasswordDTO,
  ExchangeOrderActivationDTO,
} from "./dto/link-flow-request.dto";

@Controller("auth/flow")
export class AuthLinkFlowController {
  constructor(
    private readonly activation: ActivationFlowService,
    private readonly drafts: RegistrationDraftService,
    private readonly recovery: RecoveryFlowService,
    private readonly lifecycle: FlowLifecycleService,
  ) {}

  /** Must complete in the browser before exchange: lost exchange responses can
   * then be retried with the capability it already holds. No link is consumed. */
  @Post("prepare")
  @Header("Cache-Control", "no-store")
  public async prepare(
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    FlowCookies.write(
      response,
      await this.lifecycle.prepare(FlowCookies.read(cookie)),
    );
    return { status: "READY" as const };
  }

  @Post("order-activation/exchange")
  @Header("Cache-Control", "no-store")
  public async exchange(
    @Body() input: ExchangeOrderActivationDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
    @Headers("cookie") cookie: string | undefined,
    @Res({ passthrough: true }) response: FlowCookieResponse,
  ) {
    const result = await this.activation.exchange(
      input.token,
      FlowCookies.require(cookie),
      FlowRequestEvidence.from(request),
    );
    FlowCookies.write(response, result.credentials);
    return result.state;
  }

  @Post("order-activation/password")
  @Header("Cache-Control", "no-store")
  public password(
    @Body() input: ActivationPasswordDraftDTO,
    @Headers("cookie") cookie?: string,
  ) {
    return this.drafts.saveActivation(FlowCookies.require(cookie), input);
  }

  @Post("recovery/request")
  @Header("Cache-Control", "no-store")
  public requestRecovery(
    @Body() input: RequestRegistrationCodeDTO,
    @Req() request: EvidenceRequest & { readonly body?: unknown },
  ) {
    return this.recovery.request(
      input.email,
      FlowRequestEvidence.from(request),
    );
  }

  @Post("password-reset/confirm")
  @Header("Cache-Control", "no-store")
  public confirmRecovery(@Body() input: ConfirmRecoveryPasswordDTO) {
    return this.recovery.confirm(input);
  }
}
