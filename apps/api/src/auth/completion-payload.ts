import crypto from "node:crypto";
import type {
  AdvertisingConsentDevice,
  ConsentDecisionV1,
} from "../consents/contracts/consent-decision.contract";

export interface AuthCompletionInput {
  readonly operationKey: string;
  readonly expectedStateRevision: number;
  readonly expectedAdvertisingVersion: number;
  readonly decisions: readonly ConsentDecisionV1[];
  readonly source?: string;
  readonly advertisingDevice?: AdvertisingConsentDevice;
}

/** Recoverable values live in the durable Consents command. The Auth hash also
 * fences the exact revisions used to render the form, including automatic []
 * readiness checks, without recording a fabricated acceptance. */
export class CompletionPayload {
  public static hash(
    flowId: string,
    input: AuthCompletionInput,
    revisions: {
      personalData: { revisionId: string };
      emailAdvertising: { revisionId: string };
    },
  ): string {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          flowId,
          operationKey: input.operationKey,
          expectedStateRevision: input.expectedStateRevision,
          expectedAdvertisingVersion: input.expectedAdvertisingVersion,
          personalDataRevisionId: revisions.personalData.revisionId,
          emailAdvertisingRevisionId: revisions.emailAdvertising.revisionId,
          decisions: [...input.decisions]
            .sort((left, right) =>
              left.revisionId.localeCompare(right.revisionId),
            )
            .map((decision) => ({
              revisionId: decision.revisionId,
              accepted: decision.accepted,
            })),
          source: input.source ?? null,
        }),
      )
      .digest("hex");
  }
}
