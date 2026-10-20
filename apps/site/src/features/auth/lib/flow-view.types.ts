import type {
  ConsentDecisionValues,
  ContactProfileValues,
  EmailCodeConfirmValues,
  EmailCodeRequestValues,
} from "./flow-form-values";

type FlowViewBase = {
  onCancel: () => void;
  isPending?: boolean;
  error?: string;
};

export type AuthFlowViewProps = FlowViewBase &
  (
    | {
        step: "email";
        initialEmail?: string;
        onEmail: (_values: EmailCodeRequestValues) => void;
        onYandex: () => void;
      }
    | {
        step: "code";
        email: string;
        onCode: (_values: EmailCodeConfirmValues) => void;
        onBack: () => void;
        onResend: () => void;
        resendSeconds: number;
      }
    | {
        step: "profile";
        initialProfile?: Partial<ContactProfileValues>;
        verifiedVia: "email" | "yandex";
        onProfile: (_values: ContactProfileValues) => void;
      }
    | {
        step: "consents";
        verifiedVia: "email" | "yandex";
        onConsents: (_values: ConsentDecisionValues) => void;
      }
    | { step: "provider" }
    | { step: "success" }
    | { step: "cancelled"; onRestart: () => void }
  );
