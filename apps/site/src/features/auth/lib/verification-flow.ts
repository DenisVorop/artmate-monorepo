import type { AuthEmailVerificationStateDTO } from "@/shared/actions/auth";

import type { SignupAttempt } from "./analytics";

export type EmailVerificationFlow =
  | {
      origin: "login";
      verification: AuthEmailVerificationStateDTO;
    }
  | {
      origin: "register";
      signupAttempt: SignupAttempt;
      verification: AuthEmailVerificationStateDTO;
    };

export function createLoginVerificationFlow(
  verification: AuthEmailVerificationStateDTO,
): EmailVerificationFlow {
  return { origin: "login", verification };
}

export function createSignupVerificationFlow(
  verification: AuthEmailVerificationStateDTO,
  signupAttempt: SignupAttempt,
): EmailVerificationFlow {
  return { origin: "register", signupAttempt, verification };
}

export function getSignupAttempt(flow: EmailVerificationFlow | undefined) {
  return flow?.origin === "register" ? flow.signupAttempt : undefined;
}

export function updateEmailVerificationFlow(
  flow: EmailVerificationFlow,
  verification: AuthEmailVerificationStateDTO,
): EmailVerificationFlow {
  return { ...flow, verification };
}
