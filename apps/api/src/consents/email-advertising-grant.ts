import { ServiceUnavailableException } from "@nestjs/common";
import crypto from "node:crypto";
import type { Prisma } from "../generated/prisma/client";
import type { RequestEvidenceV1 } from "../common/request-evidence";

type GrantInput = {
  email: string;
  actorUserIdSnapshot: string | null;
  revisionId: string;
  operationKey: string;
  payloadHash: string;
  source: string | null;
  requestId: string;
  requestContext: RequestEvidenceV1;
  occurredAt: Date;
} & (
  | {
      authOperationId: string;
      identityFactId: string;
      emailVerifiedAtSnapshot?: never;
    }
  | {
      authOperationId?: never;
      identityFactId?: never;
      emailVerifiedAtSnapshot: Date;
    }
);

/** Caller holds the registry and recipient locks. Both entry points commit the
 * same append-only history and authoritative permission in their transaction. */
export class EmailAdvertisingGrant {
  public static async apply(tx: Prisma.TransactionClient, input: GrantInput) {
    const recipientKey = this._recipientKey(input.email);
    const subscription =
      (await tx.emailAdvertisingSubscription.findUnique({
        where: { email: input.email },
      })) ??
      (await tx.emailAdvertisingSubscription.create({
        data: { email: input.email, ...recipientKey },
      }));
    const event = await tx.emailAdvertisingConsentEvent.create({
      data: {
        ...input,
        requestContext:
          input.requestContext as unknown as Prisma.InputJsonValue,
        subscriptionId: subscription.id,
        version: subscription.version + 1,
        action: "GRANTED",
      },
    });
    await tx.emailAdvertisingSubscription.update({
      where: { id: subscription.id },
      data: {
        state: "ACTIVE",
        version: event.version,
        activeGrantId: event.id,
      },
    });
    return event;
  }

  private static _recipientKey(email: string) {
    const secret = process.env.ADVERTISING_RECIPIENT_HMAC_SECRET;
    const keyVersion = process.env.ADVERTISING_RECIPIENT_KEY_VERSION?.trim();
    if (!secret || secret.length < 32 || !keyVersion || keyVersion.length > 32)
      throw new ServiceUnavailableException(
        "Advertising recipient key is unavailable",
      );
    return {
      recipientKey: crypto
        .createHmac("sha256", secret)
        .update(`artmate:email-advertising:recipient:v1:${email}`)
        .digest("hex"),
      keyVersion,
    };
  }
}
