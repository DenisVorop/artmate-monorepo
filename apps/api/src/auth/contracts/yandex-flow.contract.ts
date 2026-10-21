import type { AuthFlowResponseV1 } from "./flow-response.contract";

export type YandexFlowErrorCode =
  | "PROVIDER_DENIED"
  | "EMAIL_CONFIRMATION_REQUIRED"
  | "ACCOUNT_LINK_REQUIRED"
  | "ACCOUNT_UNAVAILABLE"
  | "OAUTH_EXCHANGE_FAILED";

/** Safe OAuth outcome, readable only with its browser-bound pending capability.
 * postMessage carries attemptId alone; it is never authentication evidence. */
export type YandexFlowResultV1 =
  | { readonly attemptId: string; readonly status: "WAITING" }
  | {
      readonly attemptId: string;
      readonly status: "PENDING";
      readonly state: AuthFlowResponseV1;
    }
  | {
      readonly attemptId: string;
      readonly status: "REJECTED";
      readonly errorCode: YandexFlowErrorCode;
    };
