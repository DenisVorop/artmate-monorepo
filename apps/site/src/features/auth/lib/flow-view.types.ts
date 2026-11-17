import type { AuthConsentStateDTO } from "@/shared/actions/auth";

import type {
  ConsentDecisionValues,
  ContactProfileValues,
  EmailCodeConfirmValues,
  EmailCodeRequestValues,
  PasswordLoginValues,
  PasswordCreationValues,
  RegistrationValues,
} from "./flow-form-values";

type FlowViewBase = {
  onCancel?: () => void;
  isPending?: boolean;
  error?: string;
};

export type AuthFlowViewProps = FlowViewBase &
  (
    | {
        step: "login";
        initialEmail?: string;
        emailCodeConfirmed?: boolean;
        onLogin: (_values: PasswordLoginValues) => void;
        onSignup: () => void;
        onRecovery: () => void;
        onYandex: () => void;
      }
    | {
        step: "email";
        initialEmail?: string;
        confirmExistingEmail?: boolean;
        onEmail: (_values: EmailCodeRequestValues) => void;
        onYandex: () => void;
        onLogin: () => void;
      }
    | {
        step: "registration";
        initialProfile?: Partial<ContactProfileValues>;
        missingFields?: ("name" | "phone")[];
        onRegistration: (_values: RegistrationValues) => void;
      }
    | {
        step: "activation";
        onActivation: (_values: PasswordCreationValues) => void;
      }
    | {
        step: "recovery";
        initialEmail?: string;
        onRecovery: (_values: EmailCodeRequestValues) => void;
        onLogin: () => void;
      }
    | { step: "recovery-sent"; onLogin: () => void }
    | { step: "activation-invalid"; onRecovery: () => void }
    | { step: "activation-loading" }
    | {
        step: "code";
        email: string;
        onCode: (_values: EmailCodeConfirmValues) => void;
        onBack: () => void;
        backLabel?: string;
        onResend: () => void;
        resendSeconds: number;
      }
    | {
        step: "profile";
        initialProfile?: Partial<ContactProfileValues>;
        missingFields?: ("name" | "phone")[];
        onProfile: (_values: ContactProfileValues) => void;
      }
    | {
        step: "consents";
        documents?: Pick<AuthConsentStateDTO, "personalData" | "emailAdvertising">;
        onConsents: (_values: ConsentDecisionValues) => void;
      }
    | { step: "completion"; onRetry?: () => void }
    | { step: "provider"; onLogin?: () => void }
    | { step: "success" }
    | { step: "cancelled"; onRestart: () => void }
  );
