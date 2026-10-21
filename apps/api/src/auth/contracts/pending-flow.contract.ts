/** Safe persisted read contract. Only Auth accesses credential draft columns.
 * A pending capability is browser-bound and is never an ordinary site session.
 */
export interface AuthPendingFlowV1 {
  readonly contractVersion: 1;
  readonly id: string;
  readonly identityFactId: string;
  readonly authenticationFactId: string;
  readonly userIdSnapshot: string | null;
  readonly purpose: string;
  readonly status:
    | "OPEN"
    | "COMPLETING"
    | "COMPLETED"
    | "CANCELLED"
    | "EXPIRED";
  readonly currentOperationId: string | null;
  readonly expiresAt: Date;
}

/** Auth-local token exchange. A retry returns this same continuation only after
 * checking its capability AND browser binding. Token ID alone authorizes nothing.
 * Exchange, proof publication and token CAS consumption are one transaction.
 */
export type OrderActivationExchangeResultV1 =
  | { readonly status: "PENDING"; readonly flow: AuthPendingFlowV1 }
  | {
      readonly status: "REJECTED";
      readonly errorCode:
        | "INVALID_LINK"
        | "EXPIRED_LINK"
        | "LINK_ALREADY_USED"
        | "ACCOUNT_ALREADY_ACTIVE";
    };
