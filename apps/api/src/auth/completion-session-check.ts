import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthFlowCredentials } from "./contracts/flow-response.contract";
import { AuthService } from "./auth.service";
import { FlowCredentials } from "./flow-credentials";
import { SessionAccountBinding } from "./session-account-binding";
import { CredentialsAuthService } from "./credentials-auth.service";

/** A pending capability may never replace a different currently signed-in actor.
 * SESSION continuations additionally require their still-valid source session. */
@Injectable()
export class CompletionSessionCheck {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly credentials: CredentialsAuthService,
  ) {}

  public async assert(
    credentials: AuthFlowCredentials,
    cookie?: string,
  ): Promise<void> {
    FlowCredentials.validate(credentials);
    const flow = await this.prisma.authPendingFlow.findUnique({
      where: { capabilityHash: FlowCredentials.capabilityHash(credentials) },
      include: { authentication: true, identity: true },
    });
    if (
      !flow ||
      flow.browserBindingHash !== FlowCredentials.browserHash(credentials)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    const token = this.auth.getTokenFromRequest(undefined, cookie);
    if (!token) {
      if (flow.authentication.method === "SESSION")
        throw new UnauthorizedException("The original session has expired");
      return;
    }
    let session: Awaited<ReturnType<AuthService["verifyFlowSession"]>>;
    try {
      session = await this.auth.verifyFlowSession(token);
    } catch (error) {
      if (
        !(error instanceof UnauthorizedException) ||
        flow.authentication.method === "SESSION"
      )
        throw error;
      return;
    }
    const { principal } = session;
    if (
      principal.email !== flow.identity.email ||
      (flow.userIdSnapshot && principal.id !== flow.userIdSnapshot) ||
      (flow.authentication.authVersion !== null &&
        principal.authVersion !== flow.authentication.authVersion)
    )
      throw new UnauthorizedException("The signed-in account has changed");
    if (flow.authentication.method !== "SESSION") return;
    const provider = principal.provider === "yandex" ? "YANDEX" : "CREDENTIALS";
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: principal.providerUserId,
        },
      },
      include: { credential: true },
    });
    if (
      !SessionAccountBinding.matches(
        flow.authentication,
        account,
        this.credentials.getEnvCredentialBinding(principal.email ?? ""),
      )
    )
      throw new UnauthorizedException("The signed-in account has changed");
  }
}
