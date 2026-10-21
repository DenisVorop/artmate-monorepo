import type { ConsentDocumentV1 } from "../../consents/contracts/consent-read-model";

export type AuthFlowResponseV1 =
  | {
      readonly status: "PENDING";
      readonly nextStep: "consents";
      readonly flowId: string;
      readonly expiresAt: string;
      readonly operationKey: string;
      readonly expectedStateRevision: number;
      readonly expectedAdvertisingVersion: number;
      readonly personalData: ConsentDocumentV1;
      readonly emailAdvertising: ConsentDocumentV1;
    }
  | {
      readonly status: "PENDING";
      readonly nextStep: "activation";
      readonly flowId: string;
      readonly expiresAt: string;
    }
  | {
      readonly status: "PENDING";
      readonly nextStep: "code";
      readonly generation: number;
      readonly emailMasked: string;
      readonly expiresAt: string;
      readonly resendAvailableAt: string;
    }
  | {
      readonly status: "PENDING";
      readonly nextStep: "registration";
      readonly flowId: string;
      readonly expiresAt: string;
      readonly name: string | null;
      readonly phone: string | null;
      readonly missingFields: ("name" | "phone")[];
      readonly profileRevision: number | null;
    }
  | {
      readonly status: "PENDING";
      readonly nextStep: "preparing";
      readonly flowId: string;
      readonly expiresAt: string;
      readonly emailVerified: boolean;
    }
  | {
      readonly status: "PENDING";
      readonly nextStep: "profile";
      readonly flowId: string;
      readonly expiresAt: string;
      readonly emailVerified: boolean;
      readonly name: string | null;
      readonly phone: string | null;
      readonly missingFields: ("name" | "phone")[];
      readonly profileRevision: number | null;
    }
  | { readonly status: "LOGIN_REQUIRED"; readonly nextStep: "login" };

/** Internal, only delivered as HttpOnly cookies by the transport adapter. */
export interface AuthFlowCredentials {
  readonly pending: string;
  readonly browser: string;
}

export interface AuthFlowStarted {
  readonly credentials: AuthFlowCredentials;
  readonly state: AuthFlowResponseV1;
}
