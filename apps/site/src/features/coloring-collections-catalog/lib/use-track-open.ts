"use client";

import { useEffect, useRef } from "react";

import { useAnalytics } from "./analytics";

let catalogViewSequence = 0;

export function useTrackOpen(isReady: boolean) {
  const analytics = useAnalytics();
  const viewKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!viewKeyRef.current) {
      catalogViewSequence += 1;
      viewKeyRef.current = `digital-catalog:${catalogViewSequence}`;
    }

    analytics.opened(viewKeyRef.current);
  }, [analytics, isReady]);
}
