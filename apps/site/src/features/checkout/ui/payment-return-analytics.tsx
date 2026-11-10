"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/shared/lib/cookie-consent";
import { useAnalytics } from "../lib/analytics";

type PaymentReturnAnalyticsProps = { orderId?: string } & (
  | { isFailure?: false; isAuthenticated: boolean }
  | { isFailure: true; isAuthenticated?: never }
);

export function PaymentReturnAnalytics({
  isAuthenticated,
  isFailure = false,
  orderId,
}: PaymentReturnAnalyticsProps) {
  const analytics = useAnalytics();
  const { isAccepted } = useCookieConsent();
  const lastOrder = useRef<string>(undefined);

  useEffect(() => {
    if (!isAccepted || (!isFailure && !orderId)) return;

    const visitKey = `${isFailure ? "failure" : "success"}:${orderId ?? ""}`;
    if (lastOrder.current === visitKey) return;
    lastOrder.current = visitKey;

    if (isFailure) analytics.paymentReturnFailure();
    else if (isAuthenticated) analytics.paymentReturnOwner();
    else analytics.paymentReturnGuest();
  }, [analytics, isAccepted, isAuthenticated, isFailure, orderId]);

  return null;
}
