import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  AuthAuthenticationFact,
  AuthPendingFlow,
} from "../generated/prisma/client";
import { CustomerProfileValues } from "../users/contracts/customer-profile-values";
import type { CustomerAuthDirectoryV1 } from "../users/contracts/auth-directory.contract";
import type { AuthFlowResponseV1 } from "./contracts/flow-response.contract";

/** Pure Auth routing policy. Unknown downstream readiness never means success. */
export class FlowReadiness {
  public static resolve(
    flow: AuthPendingFlow,
    auth: AuthAuthenticationFact,
    user: CustomerAuthDirectoryV1 | null,
  ): AuthFlowResponseV1 {
    if (
      flow.userIdSnapshot &&
      (!user ||
        user.status !== "active" ||
        user.authVersion !== auth.authVersion)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    if (
      ["PASSWORD", "ENV_PASSWORD", "SESSION"].includes(auth.method) &&
      !user?.emailVerifiedAt
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    if (user && user.profileRevision === null)
      throw new ServiceUnavailableException(
        "Customer profile publication is unavailable",
      );
    const profile = CustomerProfileValues.select(user, {
      name: flow.draftName,
      phone: flow.draftPhone,
    });
    if (auth.method === "EMAIL_REGISTRATION" && !flow.credentialPasswordHash)
      return {
        status: "PENDING",
        nextStep: "registration",
        flowId: flow.id,
        expiresAt: flow.expiresAt.toISOString(),
        name: profile.name || null,
        phone: profile.phone || null,
        missingFields: profile.missingFields,
        profileRevision: user?.profileRevision ?? null,
      };
    if (auth.method === "ORDER_ACTIVATION" && !flow.credentialPasswordHash)
      return {
        status: "PENDING",
        nextStep: "activation",
        flowId: flow.id,
        expiresAt: flow.expiresAt.toISOString(),
      };
    if (profile.missingFields.length)
      return {
        status: "PENDING",
        nextStep: "profile",
        flowId: flow.id,
        expiresAt: flow.expiresAt.toISOString(),
        emailVerified: true,
        name: profile.name || null,
        phone: profile.phone || null,
        missingFields: profile.missingFields,
        profileRevision: user?.profileRevision ?? null,
      };
    return {
      status: "PENDING",
      nextStep: "preparing",
      flowId: flow.id,
      expiresAt: flow.expiresAt.toISOString(),
      emailVerified: true,
    };
  }
}
