"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { isSensitivePath } from "../is-sensitive-path";

import type { AnalyticsWindow } from "./types";
import { sanitizeAnalyticsUrl } from "./sanitize-analytics-url";
import { isSilentVirtualPageView } from "./virtual-page-view";

type YandexMetrikaPageViewProps = {
  readonly counterId: number;
};

export function YandexMetrikaPageView({ counterId }: YandexMetrikaPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSensitivePath(pathname)) return;
    const currentUrl = sanitizeAnalyticsUrl(window.location.href);

    if (!currentUrl) {
      return;
    }

    if (currentUrlRef.current === null) {
      currentUrlRef.current = currentUrl;
      return;
    }

    if (currentUrlRef.current === currentUrl) {
      return;
    }

    const previousUrl = currentUrlRef.current;
    currentUrlRef.current = currentUrl;

    if (isSilentVirtualPageView(currentUrl)) return;

    try {
      (window as AnalyticsWindow).ym?.(counterId, "hit", currentUrl, {
        referer: previousUrl,
        title: document.title,
      });
    } catch {
      // Third-party analytics must not interrupt SPA navigation.
    }
  }, [counterId, pathname, searchParams]);

  return null;
}
