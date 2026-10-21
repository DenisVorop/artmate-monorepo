import crypto from "node:crypto";
import { UnauthorizedException } from "@nestjs/common";
import type { AuthFlowCredentials } from "./contracts/flow-response.contract";
import { RegistrationCode } from "./registration-code";

export class FlowCredentials {
  public static create(browser?: string): AuthFlowCredentials {
    return {
      pending: `${crypto.randomUUID()}.${crypto.randomBytes(32).toString("hex")}`,
      browser:
        browser && /^[0-9a-f]{64}$/.test(browser)
          ? browser
          : crypto.randomBytes(32).toString("hex"),
    };
  }
  public static validate(
    credentials: AuthFlowCredentials | undefined,
  ): AuthFlowCredentials {
    if (
      !credentials ||
      !/^[0-9a-f-]{36}\.[0-9a-f]{64}$/.test(credentials.pending) ||
      !/^[0-9a-f]{64}$/.test(credentials.browser)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    return credentials;
  }
  public static challengeId(credentials: AuthFlowCredentials): string {
    return credentials.pending.slice(0, 36);
  }
  public static capabilityHash(credentials: AuthFlowCredentials): string {
    return RegistrationCode.binding(credentials.pending);
  }
  public static browserHash(credentials: AuthFlowCredentials): string {
    return RegistrationCode.binding(
      `${credentials.browser}:${credentials.pending}`,
    );
  }
}
