import { createForegroundTimer } from "./foreground-timer";

export type WelcomeBonusLifecycleState = "idle" | "presented" | "ended";

type WelcomeBonusEligibility = {
  canStart: boolean;
  isEligible: boolean;
  isForeground: boolean;
  owner: string;
};

type WelcomeBonusLifecycleOptions = {
  cancel: (_handle: unknown) => void;
  canPresentNow?: () => boolean;
  durationMs: number;
  markDismissed: () => void;
  markShown: () => void;
  now: () => number;
  onStateChange: (_state: WelcomeBonusLifecycleState) => void;
  schedule: (_callback: () => void, _delay: number) => unknown;
};

type WelcomeOfferRequestInput = {
  canStart: boolean;
  isBaseEligible: boolean;
  state: WelcomeBonusLifecycleState;
};

type WelcomeBonusRevealInput = {
  isDismissedToday: boolean;
  isEligible: boolean;
  wasShownToday: boolean;
};

export function canPresentWelcomeBonusNow({
  isDismissedToday,
  isEligible,
  wasShownToday,
}: WelcomeBonusRevealInput) {
  return isEligible && !wasShownToday && !isDismissedToday;
}

export function shouldRequestWelcomeOffer({
  canStart,
  isBaseEligible,
  state,
}: WelcomeOfferRequestInput) {
  return isBaseEligible && state !== "ended" && (canStart || state === "presented");
}

export function createWelcomeBonusLifecycle({
  cancel,
  canPresentNow = () => true,
  durationMs,
  markDismissed,
  markShown,
  now,
  onStateChange,
  schedule,
}: WelcomeBonusLifecycleOptions) {
  let eligibility: WelcomeBonusEligibility | undefined;
  let presentedOwner: string | undefined;
  let state: WelcomeBonusLifecycleState = "idle";
  const timer = createForegroundTimer({
    cancel,
    durationMs,
    now,
    schedule,
    onElapsed: () => {
      if (
        state !== "idle" ||
        !eligibility?.canStart ||
        !eligibility.isEligible ||
        !eligibility.isForeground ||
        !canPresentNow()
      ) {
        end();
        return;
      }

      markShown();
      presentedOwner = eligibility.owner;
      state = "presented";
      onStateChange(state);
    },
  });

  function end() {
    timer.pause();
    if (state === "ended") {
      return;
    }

    state = "ended";
    onStateChange(state);
  }

  function update(nextEligibility: WelcomeBonusEligibility) {
    eligibility = nextEligibility;

    if (state === "ended") {
      return;
    }

    if (state === "presented") {
      if (!nextEligibility.isEligible || nextEligibility.owner !== presentedOwner) {
        end();
      }
      return;
    }

    if (
      nextEligibility.canStart &&
      nextEligibility.isEligible &&
      nextEligibility.isForeground
    ) {
      timer.resume();
    } else {
      timer.pause();
    }
  }

  function dismiss() {
    if (state !== "presented") {
      return;
    }

    markDismissed();
    end();
  }

  return {
    dismiss,
    dispose: timer.pause,
    getState: () => state,
    update,
  };
}
