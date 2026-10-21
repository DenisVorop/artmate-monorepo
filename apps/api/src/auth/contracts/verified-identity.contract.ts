/** Auth-owned persisted publication: verified_identity_facts, contract v1.
 * Consumers read facts; only Auth may publish one after proving the exact email.
 * YANDEX_VERIFIED_EMAIL records the explicitly accepted product policy: trust
 * exact default_email from the authenticated server provider exchange. It does
 * not imply an email_verified claim or a separate email-code challenge.
 * RECORDED_EMAIL_VERIFICATION preserves the existing confirmation published by
 * Users, including its original email, user and verification date.
 */
export interface VerifiedIdentityFactV1 {
  readonly contractVersion: 1;
  readonly id: string;
  readonly email: string;
  readonly method:
    | "EMAIL_CODE"
    | "YANDEX_VERIFIED_EMAIL"
    | "ORDER_ACTIVATION_LINK"
    | "RECORDED_EMAIL_VERIFICATION";
  /** Required for a recorded verification or an order activation link. */
  readonly userIdSnapshot: string | null;
  readonly sourceId: string;
  readonly verifiedAt: Date;
}
