import { createAnalytics, createGoalCommand } from "@/shared/lib/analytics";

declare const signupAttemptBrand: unique symbol;

export type SignupAttempt = {
  readonly [signupAttemptBrand]: true;
};

let signupAttemptSequence = 0;
const signupAttemptNamespace = Math.random().toString(36).slice(2);
const signupAttemptKeys = new WeakMap<SignupAttempt, string>();

const analytics = createAnalytics({
  signupCompleted: (attemptKey: string) =>
    createGoalCommand("sign_up", {}, { scope: "memory", entityKey: attemptKey }),
});

const authAnalytics = {
  signupCompleted(attempt: SignupAttempt | undefined) {
    const attemptKey = attempt ? signupAttemptKeys.get(attempt) : undefined;

    if (attemptKey) {
      analytics.send("signupCompleted", attemptKey);
    }
  },
};

export function createSignupAttempt(): SignupAttempt {
  const attempt = {} as SignupAttempt;

  signupAttemptSequence += 1;
  signupAttemptKeys.set(
    attempt,
    `registration:${signupAttemptNamespace}:${signupAttemptSequence.toString(36)}`,
  );

  return attempt;
}

export function useAnalytics() {
  return authAnalytics;
}
