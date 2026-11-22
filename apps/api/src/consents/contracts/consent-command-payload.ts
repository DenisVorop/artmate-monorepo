import crypto from "node:crypto";
import type { ApplyConsentDecisionIntentV1 } from "./consent-decision.contract";

/** Canonical immutable intent, shared by Auth's producer and Consents' inbox. */
export class ConsentCommandPayload {
  public static operationHash(input: unknown): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(_canonical(input)))
      .digest("hex");
  }
  public static hash(
    input: Omit<ApplyConsentDecisionIntentV1, "payloadHash">,
  ): string {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify(
          _canonical({
            contractVersion: input.contractVersion,
            operationId: input.operationId,
            identityFactId: input.identityFactId,
            expectedStateRevision: input.expectedStateRevision,
            expectedAdvertisingVersion: input.expectedAdvertisingVersion,
            decisions: [...input.decisions].sort((left, right) =>
              left.revisionId.localeCompare(right.revisionId),
            ),
            source: input.source ?? null,
            requestId: input.requestId,
            requestContext: input.requestContext,
            ...(input.advertisingDevice
              ? { advertisingDevice: input.advertisingDevice }
              : {}),
          }),
        ),
      )
      .digest("hex");
  }
}

function _canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(_canonical);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, _canonical(item)]),
    );
  return value;
}
