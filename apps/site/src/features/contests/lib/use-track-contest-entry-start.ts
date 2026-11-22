"use client";

import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/shared/lib/cookie-consent";
import { useAnalytics } from "./analytics";

let attemptSequence = 0;

export function useTrackContestEntryStart(slug: string | undefined, open: boolean) {
  const analytics = useAnalytics();
  const { isAccepted } = useCookieConsent();
  const attempt = useRef<{ slug: string; key: string; open: boolean } | undefined>(undefined);

  useEffect(() => {
    if (!slug || !open) {
      if (attempt.current) attempt.current.open = false;
      return;
    }
    if (!isAccepted) return;
    if (!attempt.current?.open || attempt.current.slug !== slug) {
      attempt.current = { slug, key: `contest-entry-${++attemptSequence}`, open: true };
    }
    analytics.entryStarted(slug, attempt.current.key);
  }, [analytics, slug, open, isAccepted]);
}
