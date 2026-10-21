/** Auth-owned auth_completion_operations. Only a confirmed completed operation
 * can issue a session; persisted domain command enqueue is not authentication.
 * Clients need their bound pending capability, never just this record's ID.
 */
export type AuthCompletionResultV1 =
  | { readonly status: "PENDING" }
  | { readonly status: "COMPLETED"; readonly userId: string }
  | { readonly status: "REJECTED"; readonly errorCode: string };

/** Immutable operation provenance. Users/Consents receipts still reference
 * identityFactId; the Auth operation also binds the actual authentication.
 * Expected credential/auth versions come from authenticationFactId, not clients.
 */
export interface AuthCompletionIntentV1 {
  readonly contractVersion: 1;
  readonly flowId: string;
  readonly operationKey: string;
  readonly payloadHash: string;
  readonly identityFactId: string;
  readonly authenticationFactId: string;
  readonly purpose: string;
}
