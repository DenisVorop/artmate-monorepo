"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/shared/lib/cookie-consent";
import { useAnalytics } from "./analytics";

let viewSequence = 0;

export function useTrackContestView(slug: string | undefined) {
  const analytics = useAnalytics();
  const { isAccepted } = useCookieConsent();
  const view = useRef<{ slug: string; key: string } | undefined>(undefined);

  useEffect(() => {
    if (!slug || !isAccepted) return;
    if (view.current?.slug !== slug) {
      view.current = { slug, key: `contest-view-${++viewSequence}` };
    }
    analytics.viewed(slug, view.current.key);
  }, [analytics, slug, isAccepted]);
}
