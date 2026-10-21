import type { AuthConsentStateDTO, CompleteAuthFlowInputDTO } from "@/shared/actions/auth";
import type { ConsentDecisionValues } from "./flow-form-values";

/** Bind the user's current choices to the exact server-rendered revisions. */
export function toConsentDecision(
  state: AuthConsentStateDTO,
  values: ConsentDecisionValues,
  source?: string,
): CompleteAuthFlowInputDTO {
  return {
    operationKey: state.operationKey,
    expectedStateRevision: state.expectedStateRevision,
    expectedAdvertisingVersion: state.expectedAdvertisingVersion,
    decisions: [
      { revisionId: state.personalData.revisionId, accepted: values.personalData },
      { revisionId: state.emailAdvertising.revisionId, accepted: values.advertising },
    ],
    ...(source ? { source } : {}),
  };
}
