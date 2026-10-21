import { BadRequestException, Injectable } from "@nestjs/common";
import crypto from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestEvidenceV1 } from "../common/request-evidence";
import { RecipientConsentLock } from "./contracts/recipient-consent-lock";
import { EmailAdvertisingRevision } from "./email-advertising-revision";
import { UnsubscribeToken } from "./unsubscribe-token";

export interface EmailAdvertisingStatus {
  readonly email: string;
  readonly subscribed: boolean;
  readonly version: number;
  readonly grantRevisionId?: string;
  readonly stateRevision: number;
}
interface RevokeEvidence {
  readonly actorUserId?: string;
  readonly source:
    | "notification_settings"
    | "email_unsubscribe"
    | "email_one_click";
  readonly context: RequestEvidenceV1;
}

/** Consents owns permission and withdrawal. No registry, grant key, profile or
 * new identity proof is needed to stop advertising. REVOKED is suppression. */
@Injectable()
export class EmailAdvertisingService {
  constructor(private readonly prisma: PrismaService) {}

  public async read(email: string): Promise<EmailAdvertisingStatus> {
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.emailAdvertisingSubscription.findUnique({
        where: { email },
      });
      const state = await tx.userConsentState.findUnique({
        where: { email },
        select: { revision: true },
      });
      const grantRevisionId = await EmailAdvertisingRevision.current(tx);
      return {
        email,
        subscribed: subscription?.state === "ACTIVE",
        version: subscription?.version ?? 0,
        stateRevision: state?.revision ?? 0,
        ...(grantRevisionId ? { grantRevisionId } : {}),
      };
    });
  }

  public async revoke(
    email: string,
    evidence: RevokeEvidence,
  ): Promise<EmailAdvertisingStatus> {
    return this.prisma.$transaction(async (tx) => {
      await RecipientConsentLock.acquire(tx, email);
      return this._revoke(tx, email, evidence);
    });
  }

  public async unsubscribe(
    token: string,
    evidence: RevokeEvidence,
  ): Promise<void> {
    if (!UnsubscribeToken.valid(token))
      throw new BadRequestException("Unsubscribe link is invalid");
    await this.prisma.$transaction(async (tx) => {
      const capability = await tx.emailAdvertisingUnsubscribeToken.findUnique({
        where: { tokenHash: UnsubscribeToken.hash(token) },
        select: { subscription: { select: { email: true } } },
      });
      if (!capability)
        throw new BadRequestException("Unsubscribe link is invalid");
      // Future retention may remove an already revoked recipient's address.
      // Such a capability cannot grant or reconstruct that address.
      const email = capability.subscription.email;
      if (!email) return;
      await RecipientConsentLock.acquire(tx, email);
      await this._revoke(tx, email, evidence);
    });
  }

  private async _revoke(
    tx: Prisma.TransactionClient,
    email: string,
    evidence: RevokeEvidence,
  ): Promise<EmailAdvertisingStatus> {
    const subscription = await tx.emailAdvertisingSubscription.findUnique({
      where: { email },
    });
    let version = subscription?.version ?? 0;
    if (subscription?.state === "ACTIVE") {
      const requestId = crypto.randomUUID();
      const payload = {
        subscriptionId: subscription.id,
        version: version + 1,
        actorUserId: evidence.actorUserId ?? null,
        source: evidence.source,
        requestId,
        requestContext: evidence.context,
      };
      const event = await tx.emailAdvertisingConsentEvent.create({
        data: {
          subscriptionId: subscription.id,
          version: version + 1,
          operationKey: crypto
            .createHash("sha256")
            .update(`consent-revoke:${subscription.id}:${version}`)
            .digest("hex"),
          payloadHash: crypto
            .createHash("sha256")
            .update(JSON.stringify(payload))
            .digest("hex"),
          action: "REVOKED",
          email,
          actorUserIdSnapshot: evidence.actorUserId,
          source: evidence.source,
          requestId,
          requestContext: evidence.context as unknown as Prisma.InputJsonValue,
        },
      });
      version = event.version;
      await tx.emailAdvertisingSubscription.update({
        where: { id: subscription.id },
        data: { state: "REVOKED", version, activeGrantId: null },
      });
    }
    // An explicit withdrawal fences a grant that was prepared against an older
    // state even when there was no active permission. Repeats never duplicate
    // revoke events, subscription rows or permission transitions.
    const state = await tx.userConsentState.upsert({
      where: { email },
      create: { email, revision: 1, requiredAcceptances: [] },
      update: { revision: { increment: 1 } },
    });
    const grantRevisionId = await EmailAdvertisingRevision.current(tx);
    return {
      email,
      subscribed: false,
      version,
      stateRevision: state.revision,
      ...(grantRevisionId ? { grantRevisionId } : {}),
    };
  }
}
