import crypto from "node:crypto";
import { CompletionAccountStore } from "./completion-account.store";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  Prisma,
  type AuthPendingFlow,
  type AuthCompletionOperation,
  type ApplyConsentDecisionCommand,
} from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import {
  ConsentReadModel,
  type ConsentReadinessV1,
} from "../consents/contracts/consent-read-model";
import { ConsentCommandPayload } from "../consents/contracts/consent-command-payload";
import type { ConsentDecisionV1 } from "../consents/contracts/consent-decision.contract";
import { CustomerProfileValues } from "../users/contracts/customer-profile-values";
import { ProfileCommandPayload } from "../users/contracts/profile-command-payload";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthFlowCredentials } from "./contracts/flow-response.contract";
import type { AuthPrincipal } from "./auth.types";
import { CustomerDirectoryReader } from "./customer-directory.reader";
import { CredentialsAuthService } from "./credentials-auth.service";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import {
  CompletionPayload,
  type AuthCompletionInput,
} from "./completion-payload";

export type AuthCompletionOutcome =
  | {
      status: "PENDING";
      operationId: string;
      flowId: string;
      expiresAt: string;
    }
  | { status: "REJECTED"; errorCode: string }
  | { status: "COMPLETED"; principal: AuthPrincipal };

/** Auth coordinates durable inbox receipts. Only this owner's final transaction
 * installs a credential and commits completion; domain enqueue is never login. */
@Injectable()
export class AuthCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: AuthFlowStore,
    private readonly directory: CustomerDirectoryReader,
    private readonly credentialsAuth: CredentialsAuthService,
  ) {}

  public async submit(
    credentials: AuthFlowCredentials,
    input: AuthCompletionInput,
    context: RequestEvidenceV1,
  ): Promise<AuthCompletionOutcome> {
    this._validate(input);
    await this.prisma.$transaction(async (tx) => {
      const flow = await this._bound(tx, credentials);
      const proof = await tx.verifiedIdentityFact.findUniqueOrThrow({
        where: { id: flow.identityFactId },
      });
      const consent = await ConsentReadModel.lock(
        tx,
        proof.email,
        flow.purpose,
      );
      if (!consent)
        throw new ServiceUnavailableException(
          "Consent revisions are unavailable",
        );
      if (flow.currentOperationId) {
        const operation = await tx.authCompletionOperation.findUniqueOrThrow({
          where: { id: flow.currentOperationId },
        });
        if (
          operation.operationKey !== input.operationKey ||
          operation.payloadHash !==
            CompletionPayload.hash(flow.id, input, consent)
        )
          throw new ConflictException("Completion data changed; start again");
        return;
      }
      if (!input.decisions.length)
        throw new BadRequestException("Consent decisions are required");
      await this._begin(tx, flow, input, consent, context);
    });
    return this.advance(credentials, context).then((result) => {
      if (!result)
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      return result;
    });
  }

  /** Called after pending step transitions and on bounded recovery polling.
   * An unavailable registry or a visible remaining step never grants a session. */
  public async advance(
    credentials: AuthFlowCredentials,
    context: RequestEvidenceV1,
  ): Promise<AuthCompletionOutcome | null> {
    const operationId = await this.prisma.$transaction(async (tx) => {
      const flow = await this._bound(tx, credentials);
      if (flow.currentOperationId) return flow.currentOperationId;
      if (flow.status !== "OPEN")
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      const state = await this.store.state(tx, flow);
      if (state.status !== "PENDING" || state.nextStep !== "preparing")
        return null;
      const proof = await tx.verifiedIdentityFact.findUniqueOrThrow({
        where: { id: flow.identityFactId },
      });
      const consent = await ConsentReadModel.lock(
        tx,
        proof.email,
        flow.purpose,
      );
      if (!consent || consent.needsStep) return null;
      return this._begin(
        tx,
        flow,
        {
          operationKey: flow.credentialOperationKey ?? crypto.randomUUID(),
          expectedStateRevision: consent.state.revision,
          expectedAdvertisingVersion: consent.state.advertising.version,
          decisions: [],
        },
        consent,
        context,
      );
    });
    if (!operationId) return null;
    await this.process(operationId);
    return this.prisma.$transaction(async (tx) => {
      const flow = await this._bound(tx, credentials);
      const operation = await tx.authCompletionOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
      if (operation.status === "REJECTED")
        return { status: "REJECTED" as const, errorCode: operation.errorCode! };
      if (operation.status === "PENDING")
        return {
          status: "PENDING" as const,
          operationId,
          flowId: flow.id,
          expiresAt: flow.expiresAt.toISOString(),
        };
      const principal = await this._completedPrincipal(tx, flow, operation);
      return principal
        ? { status: "COMPLETED" as const, principal }
        : {
            status: "REJECTED" as const,
            errorCode: "ACCOUNT_OR_CONSENT_CHANGED",
          };
    });
  }

  public async process(operationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const candidate = await tx.authCompletionOperation.findUnique({
        where: { id: operationId },
      });
      if (!candidate || candidate.status !== "PENDING") return;
      await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE id = ${candidate.flowId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM auth_completion_operations WHERE id = ${operationId} FOR UPDATE`;
      const operation = await tx.authCompletionOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
      if (operation.status !== "PENDING") return;
      const flow = await tx.authPendingFlow.findUnique({
        where: { id: operation.flowId },
      });
      if (
        !flow ||
        flow.currentOperationId !== operation.id ||
        flow.status !== "COMPLETING" ||
        flow.expiresAt <= new Date()
      ) {
        await this._reject(tx, flow, operation.id, "FLOW_CLOSED");
        return;
      }
      const command = await tx.applyConsentDecisionCommand.findUnique({
        where: { operationId },
      });
      if (!command || command.status === "PENDING") return;
      if (command.status === "REJECTED") {
        await this._reject(
          tx,
          flow,
          operation.id,
          command.errorCode ?? "CONSENT_REJECTED",
        );
        return;
      }
      const auth = await tx.authAuthenticationFact.findUniqueOrThrow({
        where: { id: flow.authenticationFactId },
      });
      const proof = await tx.verifiedIdentityFact.findUniqueOrThrow({
        where: { id: flow.identityFactId },
      });
      const consent = await ConsentReadModel.lock(
        tx,
        proof.email,
        flow.purpose,
      );
      if (
        !(await this._consentMatches(tx, flow, operation, command, consent))
      ) {
        await this._reject(tx, flow, operation.id, "CONSENT_CHANGED");
        return;
      }
      const profileCommand = await tx.ensureCustomerProfileCommand.findUnique({
        where: { operationId },
      });
      if (!profileCommand) {
        const current = flow.userIdSnapshot
          ? await this.directory.byId(tx, flow.userIdSnapshot)
          : null;
        if (
          flow.userIdSnapshot &&
          (!current ||
            current.email !== proof.email ||
            current.authVersion !== auth.authVersion ||
            current.status !== "active")
        ) {
          await this._reject(tx, flow, operation.id, "ACCOUNT_CHANGED");
          return;
        }
        const profile = CustomerProfileValues.select(current, {
          name: flow.draftName,
          phone: flow.draftPhone,
        });
        if (
          profile.missingFields.length ||
          (current && current.profileRevision !== flow.profileRevision)
        ) {
          await this._reject(tx, flow, operation.id, "PROFILE_CHANGED");
          return;
        }
        const intent = {
          contractVersion: 1 as const,
          operationId,
          identityFactId: flow.identityFactId,
          expectedUserId: flow.userIdSnapshot,
          expectedProfileRevision: flow.profileRevision,
          name: profile.name,
          phone: profile.phone,
        };
        await tx.ensureCustomerProfileCommand.create({
          data: { ...intent, payloadHash: ProfileCommandPayload.hash(intent) },
        });
        return;
      }
      if (profileCommand.status === "PENDING") return;
      if (profileCommand.status === "REJECTED") {
        await this._reject(
          tx,
          flow,
          operation.id,
          profileCommand.errorCode ?? "PROFILE_REJECTED",
        );
        return;
      }
      const userId = profileCommand.resultUserId!;
      await tx.$queryRaw`SELECT user_id FROM customer_profile_states WHERE user_id = ${userId} FOR SHARE`;
      const user = await this.directory.byId(tx, userId);
      if (
        !user ||
        user.email !== proof.email ||
        user.status !== "active" ||
        user.authVersion !== (auth.authVersion ?? 0) ||
        user.profileRevision !== profileCommand.resultProfileRevision ||
        !user.emailVerifiedAt
      ) {
        await this._reject(tx, flow, operation.id, "ACCOUNT_CHANGED");
        return;
      }
      const now = new Date();
      const account = await CompletionAccountStore.resolve(
        tx,
        flow,
        auth,
        user,
        now,
        false,
        this.credentialsAuth.getEnvCredentialBinding(user.email ?? ""),
      );
      if (!account) {
        await this._reject(tx, flow, operation.id, "CREDENTIAL_CHANGED");
        return;
      }
      await tx.authCompletionOperation.update({
        where: { id: operation.id },
        data: { status: "COMPLETED", resultUserId: userId, finishedAt: now },
      });
      await tx.authPendingFlow.update({
        where: { id: flow.id },
        data: {
          status: "COMPLETED",
          finishedAt: now,
          credentialPasswordHash: null,
          credentialExpiresAt: null,
          credentialOperationKey: null,
          draftName: null,
          draftPhone: null,
        },
      });
    });
  }

  private async _begin(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow,
    input: AuthCompletionInput,
    consent: ConsentReadinessV1,
    context: RequestEvidenceV1,
  ): Promise<string> {
    if (
      flow.status !== "OPEN" ||
      (flow.credentialOperationKey &&
        flow.credentialOperationKey !== input.operationKey)
    )
      throw new ConflictException("Completion data changed; start again");
    const state = await this.store.state(tx, flow);
    if (
      state.status !== "PENDING" ||
      !["preparing", "consents"].includes(state.nextStep)
    )
      throw new ConflictException(
        "Complete the preceding authentication steps",
      );
    if (
      input.expectedStateRevision !== consent.state.revision ||
      input.expectedAdvertisingVersion !== consent.state.advertising.version
    )
      throw new ConflictException("Consent state changed; reload the form");
    if (
      input.decisions.length &&
      (!input.decisions.some(
        (decision) =>
          decision.revisionId === consent.personalData.revisionId &&
          decision.accepted,
      ) ||
        !input.decisions.some(
          (decision) =>
            decision.revisionId === consent.emailAdvertising.revisionId,
        ))
    )
      throw new BadRequestException("Current consent decisions are required");
    const operation = await tx.authCompletionOperation.create({
      data: {
        flowId: flow.id,
        operationKey: input.operationKey,
        payloadHash: CompletionPayload.hash(flow.id, input, consent),
        identityFactId: flow.identityFactId,
        authenticationFactId: flow.authenticationFactId,
        purpose: flow.purpose,
      },
    });
    const grantsAdvertising =
      !consent.advertisingAccepted &&
      input.decisions.some(
        (decision) =>
          decision.revisionId === consent.emailAdvertising.revisionId &&
          decision.accepted,
      );
    // Snapshot device metadata once, with the first accepted completion request.
    const advertisingDevice = grantsAdvertising
      ? input.advertisingDevice
      : undefined;
    const intent = {
      contractVersion: 1 as const,
      operationId: operation.id,
      identityFactId: flow.identityFactId,
      expectedStateRevision: input.expectedStateRevision,
      expectedAdvertisingVersion: input.expectedAdvertisingVersion,
      decisions: input.decisions,
      source: input.source,
      requestId: crypto.randomUUID(),
      requestContext: context,
      ...(advertisingDevice ? { advertisingDevice } : {}),
    };
    await tx.applyConsentDecisionCommand.create({
      data: {
        ...intent,
        decisions: [...intent.decisions] as unknown as Prisma.InputJsonValue,
        requestContext: context as unknown as Prisma.InputJsonValue,
        advertisingDevice: advertisingDevice as
          | Prisma.InputJsonValue
          | undefined,
        payloadHash: ConsentCommandPayload.hash(intent),
      },
    });
    await tx.authPendingFlow.update({
      where: { id: flow.id },
      data: { currentOperationId: operation.id, status: "COMPLETING" },
    });
    return operation.id;
  }

  private async _consentMatches(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow,
    operation: AuthCompletionOperation,
    command: ApplyConsentDecisionCommand,
    consent: ConsentReadinessV1 | null,
  ): Promise<boolean> {
    if (
      !consent ||
      !consent.requiredAccepted ||
      consent.state.revision !== command.resultStateRevision
    )
      return false;
    const grant = await ConsentReadModel.grantForOperation(tx, operation.id);
    if (
      consent.state.advertising.version !==
      (grant?.version ?? command.expectedAdvertisingVersion)
    )
      return false;
    if (
      grant &&
      (!consent.advertisingAccepted ||
        consent.state.advertising.state !== "ACTIVE" ||
        consent.state.advertising.activeGrantId !== grant.id)
    )
      return false;
    const decisions = command.decisions as unknown as ConsentDecisionV1[];
    if (!decisions.length && consent.needsStep) return false;
    return (
      operation.payloadHash ===
      CompletionPayload.hash(
        flow.id,
        {
          operationKey: operation.operationKey,
          expectedStateRevision: command.expectedStateRevision,
          expectedAdvertisingVersion: command.expectedAdvertisingVersion,
          decisions,
          source: command.source ?? undefined,
        },
        consent,
      )
    );
  }

  private async _completedPrincipal(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow,
    operation: AuthCompletionOperation,
  ): Promise<AuthPrincipal | null> {
    if (flow.status !== "COMPLETED" || !operation.resultUserId) return null;
    const auth = await tx.authAuthenticationFact.findUniqueOrThrow({
      where: { id: flow.authenticationFactId },
    });
    const proof = await tx.verifiedIdentityFact.findUniqueOrThrow({
      where: { id: flow.identityFactId },
    });
    const command = await tx.applyConsentDecisionCommand.findUnique({
      where: { operationId: operation.id },
    });
    const consent = await ConsentReadModel.lock(tx, proof.email, flow.purpose);
    if (
      !command ||
      !(await this._consentMatches(tx, flow, operation, command, consent))
    )
      return null;
    const user = await this.directory.byId(tx, operation.resultUserId);
    if (
      !user ||
      user.status !== "active" ||
      user.email !== proof.email ||
      user.authVersion !== (auth.authVersion ?? 0) ||
      !user.emailVerifiedAt
    )
      return null;
    const account = await CompletionAccountStore.resolve(
      tx,
      flow,
      auth,
      user,
      operation.finishedAt!,
      true,
      this.credentialsAuth.getEnvCredentialBinding(user.email ?? ""),
    );
    if (!account) return null;
    return {
      id: user.userId,
      provider: account.provider === "YANDEX" ? "yandex" : "credentials",
      providerUserId: account.providerUserId,
      email: proof.email,
      name: user.name ?? undefined,
      phone: user.phone ?? undefined,
      image: user.image ?? undefined,
      roles: user.roles,
      authVersion: user.authVersion,
      envCredentialBinding:
        auth.method === "ENV_PASSWORD"
          ? (auth.envCredentialBindingSnapshot ?? undefined)
          : auth.method === "SESSION" &&
              account.provider === "CREDENTIALS" &&
              !account.credential
            ? this.credentialsAuth.getEnvCredentialBinding(user.email ?? "")
            : undefined,
    };
  }

  private async _bound(
    tx: Prisma.TransactionClient,
    credentials: AuthFlowCredentials,
  ): Promise<AuthPendingFlow> {
    FlowCredentials.validate(credentials);
    await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE capability_hash = ${FlowCredentials.capabilityHash(credentials)} FOR UPDATE`;
    const flow = await tx.authPendingFlow.findUnique({
      where: { capabilityHash: FlowCredentials.capabilityHash(credentials) },
    });
    if (
      !flow ||
      flow.browserBindingHash !== FlowCredentials.browserHash(credentials) ||
      flow.expiresAt <= new Date() ||
      (["CANCELLED", "EXPIRED"].includes(flow.status) &&
        !flow.currentOperationId)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    return flow;
  }

  private _validate(input: AuthCompletionInput): void {
    if (
      !input ||
      typeof input.operationKey !== "string" ||
      !input.operationKey.length ||
      input.operationKey.length > 64 ||
      !Number.isSafeInteger(input.expectedStateRevision) ||
      input.expectedStateRevision < 0 ||
      !Number.isSafeInteger(input.expectedAdvertisingVersion) ||
      input.expectedAdvertisingVersion < 0 ||
      !Array.isArray(input.decisions) ||
      input.decisions.length > 2 ||
      input.decisions.some(
        (decision) =>
          !decision ||
          typeof decision.revisionId !== "string" ||
          !decision.revisionId.length ||
          typeof decision.accepted !== "boolean",
      ) ||
      new Set(input.decisions.map((decision) => decision.revisionId)).size !==
        input.decisions.length ||
      (input.source !== undefined &&
        (typeof input.source !== "string" ||
          !input.source.length ||
          input.source.length > 255))
    )
      throw new BadRequestException("Invalid completion data");
  }

  private async _reject(
    tx: Prisma.TransactionClient,
    flow: AuthPendingFlow | null,
    operationId: string,
    errorCode: string,
  ): Promise<void> {
    const now = new Date();
    await tx.authCompletionOperation.update({
      where: { id: operationId },
      data: { status: "REJECTED", errorCode, finishedAt: now },
    });
    if (flow && !["COMPLETED", "CANCELLED", "EXPIRED"].includes(flow.status))
      await tx.authPendingFlow.update({
        where: { id: flow.id },
        data: {
          status: flow.expiresAt <= now ? "EXPIRED" : "CANCELLED",
          finishedAt: now,
          credentialPasswordHash: null,
          credentialExpiresAt: null,
          credentialOperationKey: null,
          draftName: null,
          draftPhone: null,
        },
      });
  }
}
