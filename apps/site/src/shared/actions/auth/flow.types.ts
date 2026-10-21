import type { AuthUserDTO } from "./auth.types";

export interface ConsentDocumentDTO {
  revisionId: string;
  version: string;
  documentTitle: string;
  documentSha256: string;
  formSha256: string;
  url: string;
}
export type AuthConsentStateDTO = {
  status: "PENDING";
  nextStep: "consents";
  flowId: string;
  expiresAt: string;
  operationKey: string;
  expectedStateRevision: number;
  expectedAdvertisingVersion: number;
  personalData: ConsentDocumentDTO;
  emailAdvertising: ConsentDocumentDTO;
};
export type CompleteAuthFlowInputDTO = {
  operationKey: string;
  expectedStateRevision: number;
  expectedAdvertisingVersion: number;
  decisions: { revisionId: string; accepted: boolean }[];
  source?: string;
};
export type AuthCompletionStateDTO =
  | {
      status: "PENDING";
      nextStep: "completion";
      operationId: string;
      flowId: string;
      expiresAt: string;
    }
  | { status: "COMPLETED"; user: AuthUserDTO }
  | { status: "REJECTED"; errorCode: string };
export type AuthReadinessDTO = AuthFlowStateDTO | AuthCompletionStateDTO;

export type AuthFlowStateDTO =
  | AuthConsentStateDTO
  | {
      status: "PENDING";
      nextStep: "activation";
      flowId: string;
      expiresAt: string;
    }
  | {
      status: "PENDING";
      nextStep: "code";
      generation: number;
      emailMasked: string;
      expiresAt: string;
      resendAvailableAt: string;
    }
  | {
      status: "PENDING";
      nextStep: "registration";
      flowId: string;
      expiresAt: string;
      name: string | null;
      phone: string | null;
      missingFields: ("name" | "phone")[];
      profileRevision: number | null;
    }
  | {
      status: "PENDING";
      nextStep: "preparing";
      flowId: string;
      expiresAt: string;
      emailVerified: boolean;
    }
  | {
      status: "PENDING";
      nextStep: "profile";
      flowId: string;
      expiresAt: string;
      emailVerified: boolean;
      name: string | null;
      phone: string | null;
      missingFields: ("name" | "phone")[];
      profileRevision: number | null;
    }
  | { status: "LOGIN_REQUIRED"; nextStep: "login" };

export type PasswordFlowInputDTO = { email: string; password: string };
export type RequestRegistrationCodeInputDTO = { email: string };
export type ConfirmRegistrationCodeInputDTO = {
  code: string;
  generation: number;
};
export type RegistrationDraftInputDTO = {
  name: string;
  phone: string;
  password: string;
  passwordConfirm: string;
  operationKey: string;
};

export type ExchangeOrderActivationInputDTO = { token: string };
export type ActivationPasswordDraftInputDTO = {
  password: string;
  passwordConfirm: string;
  operationKey: string;
};
export type RecoveryFlowInputDTO = { email: string };
export type ConfirmRecoveryPasswordInputDTO = {
  token: string;
  password: string;
  passwordConfirm: string;
};
export type RecoveryFlowResultDTO = { ok: true };

export type ProfileDraftInputDTO = { name: string; phone: string };
