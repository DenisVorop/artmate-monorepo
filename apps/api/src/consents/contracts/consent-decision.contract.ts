import type { RequestEvidenceV1 } from "../../common/request-evidence";

/** Consents owns these publications and all grant/revoke rules. Auth submits
 * decisions via apply_consent_decision_commands, never by editing subscriptions.
 * Required acceptances and advertising permission describe the exact email.
 */
export interface RequiredConsentStateV1 {
  readonly purpose: string;
  readonly revisionId: string;
  readonly acceptanceId: string;
}

export type EmailAdvertisingPermissionV1 =
  | {
      readonly state: "REVOKED";
      readonly version: number;
      readonly subscriptionId: string | null;
    }
  | {
      readonly state: "ACTIVE";
      readonly version: number;
      readonly subscriptionId: string;
      readonly activeGrantId: string;
      readonly revisionId: string;
      readonly recipientKey: string;
      readonly keyVersion: string;
    };

/** Composed by Consents from user_consent_states and its authoritative
 * subscription in one consistent read. Notifications must re-read permission
 * before handoff, not rely on an asynchronously cached copy.
 */
export interface UserConsentStateV1 {
  readonly contractVersion: 1;
  readonly email: string;
  readonly revision: number;
  readonly requiredAcceptances: readonly RequiredConsentStateV1[];
  readonly advertising: EmailAdvertisingPermissionV1;
}

export interface ConsentDecisionV1 {
  readonly revisionId: string;
  readonly accepted: boolean;
}

export interface AdvertisingConsentDevice {
  readonly timeZone?: string;
  readonly utcOffsetMinutes?: number;
  readonly platformVersion?: string;
  readonly browserVersions?: readonly { brand: string; version: string }[];
}

export interface ApplyConsentDecisionIntentV1 {
  readonly contractVersion: 1;
  readonly operationId: string;
  readonly identityFactId: string;
  readonly expectedStateRevision: number;
  readonly expectedAdvertisingVersion: number;
  readonly decisions: readonly ConsentDecisionV1[];
  readonly payloadHash: string;
  readonly source?: string;
  readonly requestId: string;
  readonly requestContext: RequestEvidenceV1;
  readonly advertisingDevice?: AdvertisingConsentDevice;
}

export type ApplyConsentDecisionResultV1 =
  | { readonly status: "PENDING" }
  | { readonly status: "COMPLETED"; readonly stateRevision: number }
  | { readonly status: "REJECTED"; readonly errorCode: string };
