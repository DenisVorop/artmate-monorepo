"use client";

import { useEffect, useRef } from "react";

import { useAnalytics } from "./analytics";

let coloringViewSequence = 0;

export function useTrackOpen(
  collectionSlug: string | undefined,
  coloringNumber: number | undefined,
) {
  const analytics = useAnalytics();
  const viewRef = useRef<{ key: string; routeKey: string } | undefined>(undefined);

  useEffect(() => {
    const normalizedSlug = collectionSlug?.trim();

    if (!normalizedSlug || !coloringNumber) {
      return;
    }

    const routeKey = `${normalizedSlug}:${coloringNumber}`;

    if (viewRef.current?.routeKey !== routeKey) {
      coloringViewSequence += 1;
      viewRef.current = {
        key: `${routeKey}:${coloringViewSequence}`,
        routeKey,
      };
    }

    analytics.opened(normalizedSlug, coloringNumber, viewRef.current.key);
  }, [analytics, collectionSlug, coloringNumber]);
}
