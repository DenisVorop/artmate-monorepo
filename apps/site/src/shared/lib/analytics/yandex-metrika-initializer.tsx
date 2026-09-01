"use client";

import { useEffect } from "react";

import type { AnalyticsWindow, YandexMetrikaFunction } from "./types";
import { sanitizeAnalyticsUrl } from "./sanitize-analytics-url";

type YandexMetrikaInitializerProps = {
  readonly counterId: number;
};

const initializedCounterIds = new Set<number>();

export function YandexMetrikaInitializer({ counterId }: YandexMetrikaInitializerProps) {
  useEffect(() => {
    if (initializedCounterIds.has(counterId)) {
      return;
    }

    try {
      const analyticsWindow = window as AnalyticsWindow;
      analyticsWindow.dataLayer ??= [];
      analyticsWindow.ym ??= createQueuedYandexMetrika();

      analyticsWindow.ym(counterId, "init", {
        ssr: true,
        webvisor: true,
        clickmap: true,
        ecommerce: "dataLayer",
        referrer: sanitizeAnalyticsUrl(document.referrer),
        url: sanitizeAnalyticsUrl(window.location.href),
        accurateTrackBounce: true,
        trackLinks: true,
      });
      initializedCounterIds.add(counterId);
    } catch {
      // Analytics initialization must not affect storefront hydration.
    }
  }, [counterId]);

  return null;
}

function createQueuedYandexMetrika(): YandexMetrikaFunction {
  const queuedYandexMetrika: YandexMetrikaFunction = (...args) => {
    queuedYandexMetrika.a ??= [];
    queuedYandexMetrika.a.push(args);
  };
  queuedYandexMetrika.l = Date.now();

  return queuedYandexMetrika;
}
