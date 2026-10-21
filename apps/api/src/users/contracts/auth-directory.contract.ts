/** Users-owned live read publication: customer_auth_directory_v1. A database
 * view avoids a stale second user store. Readers never mutate users/profiles.
 * emailVerifiedAt publishes the existing confirmation for this exact email.
 */
export interface CustomerAuthDirectoryV1 {
  readonly userId: string;
  readonly email: string | null;
  readonly name: string | null;
  readonly phone: string | null;
  readonly status: "active" | "blocked" | "deleted";
  readonly authVersion: number;
  readonly emailVerifiedAt: Date | null;
  readonly roles: ("customer" | "admin" | "partner")[];
  readonly image: string | null;
  readonly profileRevision: number | null;
}
