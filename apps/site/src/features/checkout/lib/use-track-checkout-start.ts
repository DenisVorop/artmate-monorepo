"use client";

import { useEffect, useRef } from "react";

import type { Cart } from "@/entities/cart";

import { useAnalytics } from "./analytics";

let checkoutAttemptSequence = 0;

export function useTrackCheckoutStart(cart: Cart | undefined) {
  const analytics = useAnalytics();
  const attemptRef = useRef<{ cartId: string; key: string } | undefined>(undefined);

  useEffect(() => {
    if (!cart || cart.items.length === 0 || cart.itemsCount <= 0) {
      return;
    }

    if (attemptRef.current?.cartId !== cart.id) {
      checkoutAttemptSequence += 1;
      attemptRef.current = {
        cartId: cart.id,
        key: `${cart.id}:${checkoutAttemptSequence}`,
      };
    }

    analytics.checkoutStarted(cart, attemptRef.current.key);
  }, [analytics, cart]);
}
