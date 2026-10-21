/** Persisted Notifications inbox: notification_jobs.payload, unique job ID
 * registration:<challengeId>:<generation>. Auth publishes it in the same local
 * transaction as the challenge. Delivery reads auth_registration_deliveries_v1.
 */
export interface RegistrationEmailCommandV1 {
  readonly kind: "email_registration";
  readonly contractVersion: 1;
  readonly challengeId: string;
  readonly generation: number;
}
