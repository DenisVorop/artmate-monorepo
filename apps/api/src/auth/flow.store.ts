import crypto from "node:crypto";
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  Prisma,
  type AuthPendingFlow,
  type AuthAuthenticationMethod,
} from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import type { CustomerAuthDirectoryV1 } from "../users/contracts/auth-directory.contract";
import type {
  AuthFlowCredentials,
  AuthFlowResponseV1,
} from "./contracts/flow-response.contract";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { FlowCredentials } from "./flow-credentials";
import { FlowReadiness } from "./flow-readiness";
import { CredentialsAuthService } from "./credentials-auth.service";
import { ConsentReadModel } from "../consents/contracts/consent-read-model";
import { RegistrationPolicy } from "./registration-policy";
import { SessionAccountBinding } from "./session-account-binding";

@Injectable()
export class AuthFlowStore {
  constructor(
    private readonly directory: CustomerDirectoryReader,
    private readonly credentials: CredentialsAuthService,
  ) {}

  public async find(
    tx: Prisma.TransactionClient,
    credentials: AuthFlowCredentials,
  ): Promise<AuthPendingFlow | null> {
    FlowCredentials.validate(credentials);
    const flow = await tx.authPendingFlow.findUnique({
      where: { capabilityHash: FlowCredentials.capabilityHash(credentials) },
    });
    if (
      flow &&
      (flow.browserBindingHash !== FlowCredentials.browserHash(credentials) ||
        flow.expiresAt <= new Date() ||
        flow.status !== "OPEN")
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    return flow;
  }

  public async create(
    tx: Prisma.TransactionClient,
    input: {
      credentials: AuthFlowCredentials;
      user: CustomerAuthDirectoryV1 | null;
      identityFactId: string;
      method: Extract<
        AuthAuthenticationMethod,
        | "PASSWORD"
        | "ENV_PASSWORD"
        | "EMAIL_REGISTRATION"
        | "ORDER_ACTIVATION"
        | "SESSION"
        | "YANDEX"
      >;
      accountId: string | null;
      credentialUpdatedAt: Date | null;
      envCredentialBinding?: string | null;
      sessionAccountBinding?: string;
      providerUserId?: string;
      expiresAt?: Date;
      sourceId?: string;
      authenticatedAt?: Date;
      activationToken?: { id: string; expiresAt: Date };
      context: RequestEvidenceV1;
    },
  ): Promise<AuthPendingFlow> {
    const existing = await this.find(tx, input.credentials);
    if (existing) {
      if (existing.userIdSnapshot !== (input.user?.userId ?? null))
        throw new ConflictException("Another authentication is in progress");
      return existing;
    }
    const now = new Date();
    const auth = await tx.authAuthenticationFact.create({
      data: {
        identityFactId: input.identityFactId,
        method: input.method,
        sourceId: input.sourceId ?? crypto.randomUUID(),
        userIdSnapshot: input.user?.userId,
        accountIdSnapshot: input.accountId,
        authVersion: input.user?.authVersion,
        envCredentialBindingSnapshot: input.envCredentialBinding,
        credentialUpdatedAt: input.credentialUpdatedAt,
        sessionAccountBindingSnapshot: input.sessionAccountBinding,
        providerUserIdSnapshot: input.providerUserId,
        authenticatedAt: input.authenticatedAt ?? now,
        createdAt: now,
        requestContext: input.context as unknown as Prisma.InputJsonValue,
      },
    });
    return tx.authPendingFlow.create({
      data: {
        capabilityHash: FlowCredentials.capabilityHash(input.credentials),
        browserBindingHash: FlowCredentials.browserHash(input.credentials),
        identityFactId: input.identityFactId,
        authenticationFactId: auth.id,
        purpose: "site_auth",
        userIdSnapshot: input.user?.userId,
        profileRevision: input.user?.profileRevision,
        createdAt: now,
        expiresAt: new Date(
          Math.min(
            now.getTime() + RegistrationPolicy.get().flowTtlMs,
            input.activationToken?.expiresAt.getTime() ?? Infinity,
            input.expiresAt?.getTime() ?? Infinity,
          ),
        ),
        activationTokenIdSnapshot: input.activationToken?.id,
        activationTokenExpiresAt: input.activationToken?.expiresAt,
      },
    });
  }

  public async state(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow,
  ): Promise<AuthFlowResponseV1> {
    const auth = await tx.authAuthenticationFact.findUniqueOrThrow({
      where: { id: flow.authenticationFactId },
    });
    const user = flow.userIdSnapshot
      ? await this.directory.byId(tx, flow.userIdSnapshot)
      : null;
    if (auth.method === "SESSION") {
      const account = auth.accountIdSnapshot
        ? await tx.authAccount.findUnique({
            where: { id: auth.accountIdSnapshot },
            include: { credential: true },
          })
        : null;
      if (
        !SessionAccountBinding.matches(
          auth,
          account,
          this.credentials.getEnvCredentialBinding(user?.email ?? ""),
        )
      )
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
    }
    if (auth.method === "YANDEX") {
      const account = auth.accountIdSnapshot
        ? await tx.authAccount.findUnique({
            where: { id: auth.accountIdSnapshot },
          })
        : null;
      if (
        auth.accountIdSnapshot &&
        (!account ||
          account.provider !== "YANDEX" ||
          account.providerUserId !== auth.providerUserIdSnapshot ||
          account.userId !== user?.userId)
      )
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
    }
    if (auth.method === "PASSWORD") {
      const credential = await tx.authCredential.findUnique({
        where: { accountId: auth.accountIdSnapshot! },
      });
      if (
        !credential ||
        credential.passwordUpdatedAt.getTime() !==
          auth.credentialUpdatedAt?.getTime()
      )
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      // Users publishes the verification timestamp when this login completes.
      if (!user?.emailVerifiedAt) {
        const proof = user?.email
          ? await tx.verifiedIdentityFact.findUnique({
              where: {
                id: auth.identityFactId,
                email: user.email,
                userIdSnapshot: user.userId,
                method: "EMAIL_CODE",
              },
              select: { id: true },
            })
          : null;
        if (!proof)
          throw new UnauthorizedException(
            "Auth continuation is missing or expired",
          );
      }
    }
    if (
      auth.method === "ENV_PASSWORD" &&
      this.credentials.getEnvCredentialBinding(user?.email ?? "") !==
        auth.envCredentialBindingSnapshot
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    if (auth.method === "ORDER_ACTIVATION") {
      const accounts = await tx.authAccount.findMany({
        where: { userId: flow.userIdSnapshot! },
        include: { credential: true },
      });
      if (
        !user ||
        !accounts.some((account) => account.id === auth.accountIdSnapshot) ||
        accounts.some(
          (account) => account.credential || account.provider !== "CREDENTIALS",
        ) ||
        this.credentials.getEnvCredentialBinding(user.email ?? "")
      )
        throw new ConflictException("Account is already registered; sign in");
    }
    const state = FlowReadiness.resolve(flow, auth, user);
    if (state.status !== "PENDING" || state.nextStep !== "preparing")
      return state;
    const identity = await tx.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    const consent = await ConsentReadModel.read(
      tx,
      identity.email,
      flow.purpose,
    );
    if (!consent?.needsStep) return state;
    return {
      status: "PENDING",
      nextStep: "consents",
      flowId: flow.id,
      expiresAt: flow.expiresAt.toISOString(),
      operationKey: flow.credentialOperationKey ?? flow.id,
      expectedStateRevision: consent.state.revision,
      expectedAdvertisingVersion: consent.state.advertising.version,
      personalData: consent.personalData,
      emailAdvertising: consent.emailAdvertising,
    };
  }
}
