import crypto from "node:crypto";
import type { EnsureCustomerProfileIntentV1 } from "./customer-profile.contract";

/** Canonical persisted command payload, shared by its producer and Users. */
export class ProfileCommandPayload {
  public static hash(
    input: Omit<EnsureCustomerProfileIntentV1, "payloadHash">,
  ): string {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          contractVersion: input.contractVersion,
          operationId: input.operationId,
          identityFactId: input.identityFactId,
          expectedUserId: input.expectedUserId,
          expectedProfileRevision: input.expectedProfileRevision,
          name: input.name,
          phone: input.phone,
        }),
      )
      .digest("hex");
  }
}
