/** Users-owned persisted publication: customer_profile_states, contract v1.
 * Users updates this read model atomically with its own profile changes.
 */
export interface CustomerProfileStateV1 {
  readonly contractVersion: 1;
  readonly userId: string;
  readonly revision: number;
  readonly email: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly status: "ACTIVE" | "BLOCKED" | "DELETED";
  readonly authVersion: number;
}

/** Auth enqueues ensure_customer_profile_commands; Users claims and handles it.
 * operationId binds the identity and is the deduplication key. Payload and result
 * persist independently of process lifetime; enqueue alone is never success.
 * Auth emits this intent at completion after the applicable consent gates;
 * contact-step drafts are never emitted as commands before that boundary.
 */
export interface EnsureCustomerProfileIntentV1 {
  readonly contractVersion: 1;
  readonly operationId: string;
  readonly identityFactId: string;
  readonly expectedUserId: string | null;
  readonly expectedProfileRevision: number | null;
  readonly name: string;
  readonly phone: string;
  readonly payloadHash: string;
}

export type EnsureCustomerProfileResultV1 =
  | { readonly status: "PENDING" }
  | {
      readonly status: "COMPLETED";
      readonly userId: string;
      readonly profileRevision: number;
    }
  | { readonly status: "REJECTED"; readonly errorCode: string };
