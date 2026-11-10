import {
  createAnalytics,
  createGoalCommand,
  createInteractionCommand,
} from "@/shared/lib/analytics";

declare const signupAttemptBrand: unique symbol;

export type SignupAttempt = {
  readonly [signupAttemptBrand]: true;
};

let signupAttemptSequence = 0;
const signupAttemptNamespace = Math.random().toString(36).slice(2);
const signupAttemptKeys = new WeakMap<SignupAttempt, string>();

const analytics = createAnalytics({
  menuOpened: () => createInteractionCommand("account_menu_open", {}),
  menuClosed: () => createInteractionCommand("account_menu_close", {}),
  loginOpened: () => createInteractionCommand("account_login_open", {}),
  accountOpened: () => createInteractionCommand("account_menu_account_open", {}),
  workshopOpened: () => createInteractionCommand("account_menu_workshop_open", {}),
  logoutRequested: () => createInteractionCommand("account_logout_request", {}),
  loggedOut: () => createInteractionCommand("account_logout_success", {}),
  signupCompleted: (attemptKey: string) =>
    createGoalCommand("sign_up", {}, { scope: "memory", entityKey: attemptKey }),
});

const authAnalytics = {
  menuOpened: () => analytics.send("menuOpened"),
  menuClosed: () => analytics.send("menuClosed"),
  loginOpened: () => analytics.send("loginOpened"),
  accountOpened: () => analytics.send("accountOpened"),
  workshopOpened: () => analytics.send("workshopOpened"),
  logoutRequested: () => analytics.send("logoutRequested"),
  loggedOut: () => analytics.send("loggedOut"),
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
