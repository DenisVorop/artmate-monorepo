"use client";

import { useSyncExternalStore } from "react";

import {
  getCookieConsentSnapshot,
  subscribeCookieConsent,
} from "./cookie-consent-store";

const subscribeHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useCookieConsent() {
  const isReady = useSyncExternalStore(
    subscribeHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const isAccepted = useSyncExternalStore(
    subscribeCookieConsent,
    getCookieConsentSnapshot,
    getServerSnapshot,
  );

  return { isAccepted: isReady && isAccepted, isReady };
}
