import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { RecordedEmailProof } from "./recorded-email-proof";
import type {
  AuthPendingFlow,
  AuthAuthenticationFact,
} from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { AuthService } from "./auth.service";
import { AuthFlowStore } from "./flow.store";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { CredentialsAuthService } from "./credentials-auth.service";
import { FlowCredentials } from "./flow-credentials";
import { SessionAccountBinding } from "./session-account-binding";
import type {
  AuthFlowCredentials,
  AuthFlowStarted,
} from "./contracts/flow-response.contract";

/** Existing sessions enter the same limited flow. No password/code challenge,
 * User mutation, consent write or access-cookie issuance happens at this entry. */
@Injectable()
export class SessionFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly directory: CustomerDirectoryReader,
    private readonly store: AuthFlowStore,
    private readonly credentialsAuth: CredentialsAuthService,
  ) {}

  public async start(
    cookie: string | undefined,
    context: RequestEvidenceV1,
    existing?: AuthFlowCredentials,
  ): Promise<AuthFlowStarted | null> {
    // Only a browser cookie may initialize this component session continuation.
    const token = this.auth.getTokenFromRequest(undefined, cookie);
    if (!token) return null;
    let session: Awaited<ReturnType<AuthService["verifyFlowSession"]>>;
    try {
      session = await this.auth.verifyFlowSession(token);
    } catch (error) {
      if (error instanceof UnauthorizedException) return null;
      throw error;
    }
    const { principal, expiresAt } = session;
    return this.prisma.$transaction(async (tx) => {
      let previous:
        | (AuthPendingFlow & { authentication: AuthAuthenticationFact })
        | null = null;
      if (existing) {
        await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE capability_hash = ${FlowCredentials.capabilityHash(existing)} FOR UPDATE`;
        previous = await tx.authPendingFlow.findUnique({
          where: { capabilityHash: FlowCredentials.capabilityHash(existing) },
          include: { authentication: true },
        });
      }
      const provider =
        principal.provider === "yandex" ? "YANDEX" : "CREDENTIALS";
      const found = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider,
            providerUserId: principal.providerUserId,
          },
        },
      });
      if (!found || found.userId !== principal.id) return null;
      await tx.$queryRaw`SELECT id FROM auth_accounts WHERE id = ${found.id} FOR UPDATE`;
      const account = await tx.authAccount.findUnique({
        where: { id: found.id },
        include: { credential: true },
      });
      const user = await this.directory.byId(tx, principal.id);
      if (
        !account ||
        account.userId !== principal.id ||
        account.provider !== provider ||
        account.providerUserId !== principal.providerUserId ||
        !user ||
        user.status !== "active" ||
        user.authVersion !== principal.authVersion ||
        !user.email ||
        user.email !== principal.email ||
        !user.emailVerifiedAt ||
        expiresAt <= new Date()
      )
        return null;
      const envBinding = this.credentialsAuth.getEnvCredentialBinding(
        user.email,
      );
      if (
        provider === "CREDENTIALS" &&
        (account.providerUserId !== user.email ||
          (!account.credential &&
            envBinding !== principal.envCredentialBinding))
      )
        return null;
      const binding = SessionAccountBinding.hash(account, envBinding);
      if (!binding) return null;
      let credentials = existing ?? FlowCredentials.create();
      if (existing) {
        if (
          previous &&
          previous.browserBindingHash !== FlowCredentials.browserHash(existing)
        )
          throw new UnauthorizedException("Invalid auth continuation");
        if (
          previous &&
          previous.status === "OPEN" &&
          previous.expiresAt > new Date()
        ) {
          if (
            previous.userIdSnapshot !== user.userId ||
            previous.authentication.method !== "SESSION"
          )
            throw new ConflictException(
              "Another authentication is in progress",
            );
          if (
            !SessionAccountBinding.matches(
              previous.authentication,
              account,
              envBinding,
            ) ||
            previous.authentication.authVersion !== user.authVersion
          )
            credentials = FlowCredentials.create(existing.browser);
        } else credentials = FlowCredentials.create(existing.browser);
      }
      const proof = await RecordedEmailProof.resolve(tx, user, context);
      const flow = await this.store.create(tx, {
        credentials,
        user,
        identityFactId: proof.id,
        method: "SESSION",
        accountId: account.id,
        credentialUpdatedAt: null,
        sessionAccountBinding: binding,
        expiresAt,
        context,
      });
      return { credentials, state: await this.store.state(tx, flow) };
    });
  }
}
