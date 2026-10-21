import { BadRequestException, Injectable } from "@nestjs/common";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { OrderActivationService } from "./order-activation.service";
import { PasswordResetService } from "./password-reset.service";

/** Reuse the existing Auth recovery, delivery and session-revocation policy. */
@Injectable()
export class RecoveryFlowService {
  constructor(
    private readonly activation: OrderActivationService,
    private readonly passwords: PasswordResetService,
  ) {}

  public request(email: string, context: RequestEvidenceV1) {
    return this.activation.requestRecovery({
      email,
      ipAddress: context.client.ipAddress ?? undefined,
    });
  }

  public confirm(input: {
    token: string;
    password: string;
    passwordConfirm: string;
  }) {
    if (input.password !== input.passwordConfirm)
      throw new BadRequestException("Passwords do not match");
    return this.passwords.confirmReset({
      token: input.token,
      password: input.password,
    });
  }
}
