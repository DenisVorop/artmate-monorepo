"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

import {
  featureBannerSlugs,
  getFeatureBannersBySlug,
  useFeatureBanners,
} from "@/entities/feature-banners";
import { useWelcomeOffer } from "@/entities/promocode";
import { useSession } from "@/entities/session";
import { useCookieConsent } from "@/shared/lib/cookie-consent";
import { getQueryOwner } from "@/shared/lib/query-keys";

import { isWelcomeBonusPathEligible } from "./eligibility";
import { useAnalytics } from "./analytics";
import { createMoscowDayRollover } from "./moscow-day-rollover";
import { getMoscowDayKey } from "./moscow-day";
import {
  markWelcomeBonusDismissedToday,
  markWelcomeBonusShownToday,
  wasWelcomeBonusDismissedToday,
  wasWelcomeBonusShownToday,
} from "./persistence";
import {
  canPresentWelcomeBonusNow,
  createWelcomeBonusLifecycle,
  shouldRequestWelcomeOffer,
  type WelcomeBonusLifecycleState,
} from "./welcome-bonus-lifecycle";

const appearanceDelayMs = 10_000;
const maxTimeoutMs = 2_147_483_647;
const subscribeHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useWelcomeBonus() {
  const analytics = useAnalytics();
  const pathname = usePathname();
  const { isPending: isSessionPending, user } = useSession();
  const { isAccepted: isCookieConsentAccepted } = useCookieConsent();
  const isClient = useSyncExternalStore(subscribeHydration, getClientSnapshot, getServerSnapshot);
  const [state, setState] = useState<WelcomeBonusLifecycleState>("idle");
  const [moscowDayKey, setMoscowDayKey] = useState<string>();
  const [expiryCheckVersion, rerenderAtExpiry] = useState(0);
  const lifecycleRef = useRef<ReturnType<typeof createWelcomeBonusLifecycle> | null>(null);
  const isAuthoritativelyEligibleRef = useRef(false);
  const owner = getQueryOwner(user?.id);
  const isPathEligible = isWelcomeBonusPathEligible(pathname);
  const featureBanners = useFeatureBanners({
    enabled: !isSessionPending,
    owner,
  });
  const bannersBySlug = getFeatureBannersBySlug(featureBanners.banners);
  const hasWelcomeBonusFlag = Boolean(bannersBySlug[featureBannerSlugs.welcomeBonus]);
  const canStart = Boolean(
    isClient &&
    moscowDayKey &&
    !wasWelcomeBonusShownToday(moscowDayKey) &&
    !wasWelcomeBonusDismissedToday(moscowDayKey),
  );
  const isBaseEligible =
    !isSessionPending && isCookieConsentAccepted && isPathEligible && hasWelcomeBonusFlag;
  const shouldRequestOffer = shouldRequestWelcomeOffer({
    canStart,
    isBaseEligible,
    state,
  });
  const { data: offer } = useWelcomeOffer({
    enabled: shouldRequestOffer,
    owner,
  });
  const isAuthoritativelyEligible = isBaseEligible && Boolean(offer);
  const isPresented = state === "presented" && isAuthoritativelyEligible;
  isAuthoritativelyEligibleRef.current = isAuthoritativelyEligible;

  useEffect(() => {
    if (!isPresented || !moscowDayKey || !offer) {
      return;
    }

    analytics.promotionPresented({ dayKey: moscowDayKey, offer });
  }, [analytics, isPresented, moscowDayKey, offer]);

  useEffect(() => {
    const rollover = createMoscowDayRollover({
      now: () => Date.now(),
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (handle) => window.clearTimeout(handle as number),
      onDayChange: (dayKey) => {
        lifecycleRef.current?.dispose();
        lifecycleRef.current = null;
        setState("idle");
        setMoscowDayKey(dayKey);
      },
    });

    rollover.sync();
    document.addEventListener("visibilitychange", rollover.sync);

    return () => {
      document.removeEventListener("visibilitychange", rollover.sync);
      rollover.dispose();
    };
  }, []);

  useEffect(() => {
    if (!moscowDayKey) {
      return;
    }

    const lifecycle = createWelcomeBonusLifecycle({
      durationMs: appearanceDelayMs,
      now: () => Date.now(),
      schedule: (callback, delay) => window.setTimeout(callback, delay),
      cancel: (handle) => window.clearTimeout(handle as number),
      canPresentNow: () =>
        canPresentWelcomeBonusNow({
          isDismissedToday: wasWelcomeBonusDismissedToday(moscowDayKey),
          isEligible:
            getMoscowDayKey(Date.now()) === moscowDayKey && isAuthoritativelyEligibleRef.current,
          wasShownToday: wasWelcomeBonusShownToday(moscowDayKey),
        }),
      markShown: () => markWelcomeBonusShownToday(moscowDayKey),
      markDismissed: () => markWelcomeBonusDismissedToday(moscowDayKey),
      onStateChange: setState,
    });
    lifecycleRef.current = lifecycle;

    return () => {
      lifecycle.dispose();
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
    };
  }, [moscowDayKey]);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) {
      return;
    }

    function updateLifecycle() {
      lifecycle?.update({
        canStart,
        isEligible: isAuthoritativelyEligible,
        isForeground: document.visibilityState === "visible",
        owner,
      });
    }

    updateLifecycle();
    document.addEventListener("visibilitychange", updateLifecycle);

    return () => {
      document.removeEventListener("visibilitychange", updateLifecycle);
    };
  }, [canStart, isAuthoritativelyEligible, moscowDayKey, owner]);

  useEffect(() => {
    if (!offer?.endsAt) {
      return;
    }

    const delay = Date.parse(offer.endsAt) - Date.now();
    if (delay <= 0) {
      return;
    }

    const handle = window.setTimeout(
      () => rerenderAtExpiry((version) => version + 1),
      Math.min(delay, maxTimeoutMs),
    );
    return () => window.clearTimeout(handle);
  }, [expiryCheckVersion, offer?.endsAt]);

  return {
    activate: () => {
      if (isPresented && moscowDayKey && offer) {
        analytics.promotionClicked({ dayKey: moscowDayKey, offer });
      }

      lifecycleRef.current?.dismiss();
    },
    dismiss: () => lifecycleRef.current?.dismiss(),
    isPresented,
    offer,
  };
}
