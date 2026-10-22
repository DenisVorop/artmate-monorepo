import type {
  ActivationPasswordDraftInputDTO,
  AuthReadinessDTO,
  AuthUserDTO,
  CompleteAuthFlowInputDTO,
  ConfirmRegistrationCodeInputDTO,
  PasswordFlowInputDTO,
  ProfileDraftInputDTO,
  RecoveryFlowInputDTO,
  RegistrationDraftInputDTO,
  RequestRegistrationCodeInputDTO,
} from "@/shared/actions/auth";

export type AuthFailure = {
  code:
    | "cancelled"
    | "busy"
    | "authentication_failed"
    | "flow_expired"
    | "session_expired"
    | "state_unavailable"
    | "profile_incomplete"
    | "required_consent_missing"
    | "provider_unavailable";
};
export type AuthOutcome =
  | { status: "success"; user: AuthUserDTO }
  | { status: "error"; error: AuthFailure };
export type AuthOptions<Payload = void> = {
  onSuccess?: (_user: AuthUserDTO, _payload: Payload) => void | Promise<void>;
  onError?: (_error: AuthFailure, _payload: Payload) => void | Promise<void>;
};
export type AuthFlowConfig = {
  presentation?: "inline";
  purpose?: "site_auth";
  source?: string;
  initialEmail?: string;
};
export type AuthRouteEntry =
  | { type: "activation"; token: string }
  | { type: "recovery" }
  | { type: "resume" };

export type AuthFlowSnapshot = {
  step:
    | "closed"
    | "loading"
    | "provider"
    | "login"
    | "email"
    | "code"
    | "registration"
    | "activation"
    | "profile"
    | "consents"
    | "completion"
    | "recovery"
    | "success";
  visible: boolean;
  pending: boolean;
  error: string | null;
  email: string;
  recoverySent: boolean;
  canRetry: boolean;
  flow?: AuthReadinessDTO;
  user?: AuthUserDTO;
};

/** Mutation hooks unwrap transport DTOs; the coordinator owns only UI state and continuation. */
export interface AuthFlowPorts {
  start(_config: AuthFlowConfig): Promise<AuthReadinessDTO>;
  login(_input: PasswordFlowInputDTO): Promise<AuthReadinessDTO>;
  requestCode(_input: RequestRegistrationCodeInputDTO): Promise<AuthReadinessDTO>;
  confirmCode(_input: ConfirmRegistrationCodeInputDTO): Promise<AuthReadinessDTO>;
  resend(): Promise<AuthReadinessDTO>;
  saveRegistration(_input: RegistrationDraftInputDTO): Promise<AuthReadinessDTO>;
  saveActivation(_input: ActivationPasswordDraftInputDTO): Promise<AuthReadinessDTO>;
  saveProfile(_input: ProfileDraftInputDTO): Promise<AuthReadinessDTO>;
  complete(_input: CompleteAuthFlowInputDTO): Promise<AuthReadinessDTO>;
  resume(): Promise<AuthReadinessDTO>;
  cancel(): Promise<unknown>;
  recovery(_input: RecoveryFlowInputDTO): Promise<unknown>;
  publishSession(_user: AuthUserDTO): Promise<void>;
  exchangeActivation?: (_input: { token: string }) => Promise<AuthReadinessDTO>;
  yandex?: () => Promise<AuthReadinessDTO>;
  cancelProvider?: () => void;
  registrationCompleted?: () => void;
  now?: () => number;
  wait?: (_milliseconds: number) => Promise<void>;
  operationKey?: () => string;
}
