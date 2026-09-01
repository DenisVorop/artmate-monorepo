"use client";

import { useEffect, useRef } from "react";

import { useAnalytics } from "./analytics";

let collectionViewSequence = 0;

export function useTrackOpen(collectionSlug: string | undefined) {
  const analytics = useAnalytics();
  const viewRef = useRef<{ key: string; slug: string } | undefined>(undefined);

  useEffect(() => {
    const normalizedSlug = collectionSlug?.trim();

    if (!normalizedSlug) {
      return;
    }

    if (viewRef.current?.slug !== normalizedSlug) {
      collectionViewSequence += 1;
      viewRef.current = {
        key: `${normalizedSlug}:${collectionViewSequence}`,
        slug: normalizedSlug,
      };
    }

    analytics.opened(normalizedSlug, viewRef.current.key);
  }, [analytics, collectionSlug]);
}
