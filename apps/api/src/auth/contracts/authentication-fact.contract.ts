/** Auth-owned immutable authentication snapshot. sourceId is the deduplication
 * ID of a successful Auth operation, consumed link or real provider exchange.
 * SESSION uses a fresh continuation operation ID, never an invented session ID.
 * No password or bearer token is published. No session is issued
 * by publishing this fact. Exact-email verification remains a separate fact.
 */
export type AuthAuthenticationFactV1 = {
  readonly contractVersion: 1;
  readonly id: string;
  readonly identityFactId: string;
  readonly sourceId: string;
  readonly authenticatedAt: Date;
} & (
  | {
      readonly method: "PASSWORD";
      readonly userIdSnapshot: string;
      readonly accountIdSnapshot: string;
      readonly authVersion: number;
      readonly credentialUpdatedAt: Date;
    }
  | {
      readonly method: "ENV_PASSWORD";
      readonly userIdSnapshot: string;
      readonly accountIdSnapshot: string;
      readonly authVersion: number;
      readonly credentialUpdatedAt: null;
    }
  | {
      readonly method: "ORDER_ACTIVATION" | "SESSION";
      readonly userIdSnapshot: string;
      readonly accountIdSnapshot: string | null;
      readonly authVersion: number;
      readonly credentialUpdatedAt: null;
    }
  | {
      readonly method: "YANDEX";
      readonly userIdSnapshot: string | null;
      readonly accountIdSnapshot: string | null;
      readonly providerUserIdSnapshot: string;
      readonly authVersion: number | null;
      readonly credentialUpdatedAt: null;
    }
  | ({
      readonly method: "EMAIL_REGISTRATION";
      readonly credentialUpdatedAt: null;
    } & (
      | {
          readonly userIdSnapshot: null;
          readonly accountIdSnapshot: null;
          readonly authVersion: null;
        }
      | {
          readonly userIdSnapshot: string;
          readonly accountIdSnapshot: string | null;
          readonly authVersion: number;
        }
    ))
);
