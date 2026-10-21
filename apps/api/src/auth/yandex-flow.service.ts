import crypto from "node:crypto";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { OAuthState, Prisma } from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthFlowCredentials } from "./contracts/flow-response.contract";
import type {
  YandexFlowErrorCode,
  YandexFlowResultV1,
} from "./contracts/yandex-flow.contract";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { RecordedEmailProof } from "./recorded-email-proof";
import { PasswordHasher } from "./password-hasher";
import { YandexFlowCookies } from "./yandex-flow-cookies";
import { YandexOAuthService } from "./yandex-oauth.service";
import type { YandexCallbackDTO } from "./dto/yandex-flow.dto";

/** Auth owns the attempt, authentication and provider-email trust policy.
 * Linking waits for common completion; Users remains receipt-owned. */
@Injectable()
export class YandexFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: YandexOAuthService,
    private readonly directory: CustomerDirectoryReader,
    private readonly store: AuthFlowStore,
  ) {}

  public async start(existing?: AuthFlowCredentials) {
    const credentials = FlowCredentials.create(existing?.browser);
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = this._challenge(verifier);
    const authorizationUrl = this.provider.getAuthorizationUrl(
      state,
      challenge,
    );
    const attempt = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        const flow = await tx.authPendingFlow.findUnique({
          where: { capabilityHash: FlowCredentials.capabilityHash(existing) },
        });
        if (
          flow &&
          flow.browserBindingHash !== FlowCredentials.browserHash(existing)
        )
          this._invalid();
        if (
          flow &&
          ["OPEN", "COMPLETING"].includes(flow.status) &&
          flow.expiresAt > new Date()
        )
          throw new ConflictException("Another authentication is in progress");
        await tx.oAuthState.updateMany({
          where: {
            capabilityHash: FlowCredentials.capabilityHash(existing),
            browserBindingHash: FlowCredentials.browserHash(existing),
            cancelledAt: null,
          },
          data: { cancelledAt: new Date() },
        });
      }
      return tx.oAuthState.create({
        data: {
          provider: "YANDEX",
          stateHash: this._hash(state),
          capabilityHash: FlowCredentials.capabilityHash(credentials),
          browserBindingHash: FlowCredentials.browserHash(credentials),
          pkceChallenge: challenge,
          redirectUri: this.provider.getRedirectUri(),
          expiresAt: new Date(Date.now() + 600_000),
        },
      });
    });
    return {
      credentials,
      state,
      verifier,
      attemptId: attempt.id,
      authorizationUrl,
    };
  }

  public async callback(
    credentials: AuthFlowCredentials,
    input: YandexCallbackDTO,
    cookie: string | undefined,
    context: RequestEvidenceV1,
  ): Promise<YandexFlowResultV1> {
    FlowCredentials.validate(credentials);
    const inputHash = this._hash(
      JSON.stringify({ code: input.code ?? null, error: input.error ?? null }),
    );
    const claim = await this.prisma.$transaction(async (tx) => {
      const found = await tx.oAuthState.findUnique({
        where: { stateHash: this._hash(input.state) },
      });
      if (!found) this._invalid();
      await tx.$queryRaw`SELECT id FROM oauth_states WHERE id = ${found.id} FOR UPDATE`;
      const attempt = await tx.oAuthState.findUniqueOrThrow({
        where: { id: found.id },
      });
      this._assertBound(attempt, credentials);
      if (attempt.consumedAt) {
        if (attempt.exchangeCodeHash !== inputHash) this._invalid();
        return { attempt, claimed: false };
      }
      const oauth = YandexFlowCookies.read(cookie);
      if (
        !PasswordHasher.equal(input.state, oauth.state) ||
        !PasswordHasher.equal(
          attempt.pkceChallenge!,
          this._challenge(oauth.verifier),
        ) ||
        (!input.code && !input.error) ||
        (!!input.code && !!input.error)
      )
        this._invalid();
      const consumed = await tx.oAuthState.update({
        where: { id: attempt.id },
        data: { consumedAt: new Date(), exchangeCodeHash: inputHash },
      });
      return { attempt: consumed, claimed: true, verifier: oauth.verifier };
    });
    if (!claim.claimed) return this.result(credentials, claim.attempt.id);
    if (input.error)
      return this._reject(credentials, claim.attempt.id, "PROVIDER_DENIED");
    let identity: Awaited<ReturnType<YandexOAuthService["getIdentityByCode"]>>;
    try {
      identity = await this.provider.getIdentityByCode(
        input.code!,
        claim.verifier!,
      );
    } catch {
      return this._reject(
        credentials,
        claim.attempt.id,
        "OAUTH_EXCHANGE_FAILED",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM oauth_states WHERE id = ${claim.attempt.id} FOR UPDATE`;
      const attempt = await tx.oAuthState.findUniqueOrThrow({
        where: { id: claim.attempt.id },
      });
      this._assertBound(attempt, credentials);
      const account = await tx.authAccount.findUnique({
        where: {
          provider_providerUserId: {
            provider: "YANDEX",
            providerUserId: identity.providerUserId,
          },
        },
      });
      const providerEmail = identity.contactEmail;
      let user = account
        ? await this.directory.byId(tx, account.userId)
        : providerEmail
          ? await this.directory.byEmail(tx, providerEmail)
          : null;
      if (account) {
        await tx.$queryRaw`SELECT id FROM auth_accounts WHERE id = ${account.id} FOR UPDATE`;
        const current = await tx.authAccount.findUnique({
          where: { id: account.id },
        });
        user = await this.directory.byId(tx, account.userId);
        if (
          !current ||
          current.provider !== "YANDEX" ||
          current.providerUserId !== identity.providerUserId ||
          current.userId !== account.userId
        )
          return this._saveRejection(tx, attempt.id, "ACCOUNT_LINK_REQUIRED");
      }
      if ((account && !user) || (user && user.status !== "active"))
        return this._saveRejection(tx, attempt.id, "ACCOUNT_UNAVAILABLE");
      if (!account && user) {
        const existing = await tx.authAccount.findUnique({
          where: {
            userId_provider: { userId: user.userId, provider: "YANDEX" },
          },
        });
        if (existing)
          return this._saveRejection(tx, attempt.id, "ACCOUNT_LINK_REQUIRED");
      }
      const canReuse = !!account && !!user?.email && !!user.emailVerifiedAt;
      if (
        !canReuse &&
        (!providerEmail || (account && user?.email !== providerEmail))
      )
        return this._saveRejection(
          tx,
          attempt.id,
          "EMAIL_CONFIRMATION_REQUIRED",
        );
      // Product policy explicitly trusts the exact default_email returned by
      // Yandex over the authenticated server exchange. This is not a claim that
      // the provider returned email_verified, and it does not invent an OTP.
      const proof = canReuse
        ? await RecordedEmailProof.resolve(tx, user!, context)
        : await tx.verifiedIdentityFact.create({
            data: {
              email: providerEmail!,
              method: "YANDEX_VERIFIED_EMAIL",
              sourceId: attempt.id,
              userIdSnapshot: user?.userId,
              verifiedAt: new Date(),
              requestContext: context as unknown as Prisma.InputJsonValue,
            },
          });
      const flow = await this.store.create(tx, {
        credentials,
        user,
        identityFactId: proof.id,
        method: "YANDEX",
        providerUserId: identity.providerUserId,
        accountId: account?.id ?? null,
        credentialUpdatedAt: null,
        sourceId: attempt.id,
        context,
        expiresAt: attempt.expiresAt,
      });
      await tx.oAuthState.update({
        where: { id: attempt.id },
        data: { resultFlowIdSnapshot: flow.id, resultCode: "FLOW_READY" },
      });
      return {
        attemptId: attempt.id,
        status: "PENDING",
        state: await this.store.state(tx, flow),
      };
    });
  }

  public async result(
    credentials: AuthFlowCredentials,
    attemptId: string,
  ): Promise<YandexFlowResultV1> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.oAuthState.findUnique({
        where: { id: attemptId },
      });
      if (!attempt) this._invalid();
      this._assertBound(attempt, credentials);
      if (!attempt.resultCode) return { attemptId, status: "WAITING" };
      if (attempt.resultCode !== "FLOW_READY")
        return {
          attemptId,
          status: "REJECTED",
          errorCode: attempt.resultCode as YandexFlowErrorCode,
        };
      const flow = await tx.authPendingFlow.findUnique({
        where: { id: attempt.resultFlowIdSnapshot! },
      });
      if (
        !flow ||
        flow.capabilityHash !== FlowCredentials.capabilityHash(credentials) ||
        ["CANCELLED", "EXPIRED"].includes(flow.status)
      )
        this._invalid();
      const state =
        flow.status === "OPEN"
          ? await this.store.state(tx, flow)
          : {
              status: "PENDING" as const,
              nextStep: "preparing" as const,
              flowId: flow.id,
              expiresAt: flow.expiresAt.toISOString(),
              emailVerified: true,
            };
      return { attemptId, status: "PENDING", state };
    });
  }

  private async _reject(
    credentials: AuthFlowCredentials,
    id: string,
    error: YandexFlowErrorCode,
  ): Promise<YandexFlowResultV1> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM oauth_states WHERE id = ${id} FOR UPDATE`;
      const attempt = await tx.oAuthState.findUniqueOrThrow({ where: { id } });
      this._assertBound(attempt, credentials);
      return this._saveRejection(tx, id, error);
    });
  }

  private async _saveRejection(
    tx: Prisma.TransactionClient,
    attemptId: string,
    errorCode: YandexFlowErrorCode,
  ): Promise<YandexFlowResultV1> {
    await tx.oAuthState.update({
      where: { id: attemptId },
      data: { resultCode: errorCode },
    });
    return { attemptId, status: "REJECTED", errorCode };
  }

  private _assertBound(
    attempt: OAuthState,
    credentials: AuthFlowCredentials,
  ): void {
    if (
      attempt.provider !== "YANDEX" ||
      attempt.cancelledAt ||
      attempt.expiresAt <= new Date() ||
      !attempt.pkceChallenge ||
      attempt.capabilityHash !== FlowCredentials.capabilityHash(credentials) ||
      attempt.browserBindingHash !== FlowCredentials.browserHash(credentials)
    )
      this._invalid();
  }
  private _hash(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
  private _challenge(value: string): string {
    return crypto.createHash("sha256").update(value).digest("base64url");
  }
  private _invalid(): never {
    throw new UnauthorizedException("OAuth continuation is missing or expired");
  }
}
