import { Injectable, UnauthorizedException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthFlowCredentials,
  AuthFlowResponseV1,
} from "./contracts/flow-response.contract";
import { AuthFlowStore } from "./flow.store";
import { FlowCredentials } from "./flow-credentials";
import { RegistrationCodeService } from "./registration-code.service";

/** One lifecycle for browser-bound authentication continuations. The challenge
 * lock precedes the flow lock, matching confirm's publication order.
 */
@Injectable()
export class FlowLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: AuthFlowStore,
    private readonly codes: RegistrationCodeService,
  ) {}

  /** Preserve an open exchange for response recovery, but never reuse a
   * completed/cancelled capability to start an unrelated activation. */
  public async prepare(
    credentials?: AuthFlowCredentials,
  ): Promise<AuthFlowCredentials> {
    if (!credentials) return FlowCredentials.create();
    FlowCredentials.validate(credentials);
    const flow = await this.prisma.authPendingFlow.findUnique({
      where: { capabilityHash: FlowCredentials.capabilityHash(credentials) },
      select: { browserBindingHash: true, status: true, expiresAt: true },
    });
    if (
      flow &&
      flow.browserBindingHash !== FlowCredentials.browserHash(credentials)
    )
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    // An operation with an unknown result must retain its recovery capability,
    // including after its initial interactive lifetime has expired.
    if (!flow || flow.status === "COMPLETING") return credentials;
    return flow.status === "OPEN" && flow.expiresAt > new Date()
      ? credentials
      : FlowCredentials.create();
  }

  public async read(
    credentials: AuthFlowCredentials,
  ): Promise<AuthFlowResponseV1> {
    FlowCredentials.validate(credentials);
    return this.prisma.$transaction(async (tx) => {
      const challenge = await this._lockChallenge(tx, credentials);
      const flow = await this.store.find(tx, credentials);
      if (flow) return this.store.state(tx, flow);
      if (challenge) return this.codes.readChallengeState(tx, challenge);
      throw new UnauthorizedException(
        "Auth continuation is missing or expired",
      );
    });
  }

  public async cancel(credentials: AuthFlowCredentials): Promise<void> {
    FlowCredentials.validate(credentials);
    await this.prisma.$transaction(async (tx) => {
      const challenge = await this._lockChallenge(tx, credentials);
      const attempts = await tx.oAuthState.updateMany({
        where: {
          capabilityHash: FlowCredentials.capabilityHash(credentials),
          browserBindingHash: FlowCredentials.browserHash(credentials),
          cancelledAt: null,
        },
        data: { cancelledAt: new Date() },
      });
      await tx.$queryRaw`SELECT id FROM auth_pending_flows WHERE capability_hash = ${FlowCredentials.capabilityHash(credentials)} FOR UPDATE`;
      const flow = await tx.authPendingFlow.findUnique({
        where: { capabilityHash: FlowCredentials.capabilityHash(credentials) },
      });
      if (
        flow &&
        flow.browserBindingHash !== FlowCredentials.browserHash(credentials)
      )
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      if (flow?.currentOperationId) {
        await tx.$queryRaw`SELECT id FROM auth_completion_operations WHERE id = ${flow.currentOperationId} FOR UPDATE`;
        await tx.authCompletionOperation.updateMany({
          where: { id: flow.currentOperationId, status: "PENDING" },
          data: {
            status: "REJECTED",
            errorCode: "CANCELLED",
            finishedAt: new Date(),
          },
        });
      }
      if (!flow && !challenge && !attempts.count)
        throw new UnauthorizedException(
          "Auth continuation is missing or expired",
        );
      if (flow && ["OPEN", "COMPLETING"].includes(flow.status))
        await tx.authPendingFlow.update({
          where: { id: flow.id },
          data: {
            status: "CANCELLED",
            finishedAt: new Date(),
            credentialPasswordHash: null,
            credentialExpiresAt: null,
            credentialOperationKey: null,
            draftName: null,
            draftPhone: null,
          },
        });
      if (challenge && !challenge.consumedAt)
        await tx.authEmailChallenge.update({
          where: { id: challenge.id },
          data: { consumedAt: new Date() },
        });
    });
  }

  private async _lockChallenge(
    tx: Prisma.TransactionClient,
    credentials: AuthFlowCredentials,
  ) {
    const exists = await tx.authEmailChallenge.findUnique({
      where: { id: FlowCredentials.challengeId(credentials) },
      select: { id: true },
    });
    return exists ? this.codes.lock(tx, credentials) : null;
  }
}
