"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { isSensitivePath } from "../is-sensitive-path";
import { sanitizeAnalyticsUrl } from "./sanitize-analytics-url";
import type { AnalyticsWindow } from "./types";
import { isSilentVirtualPageView } from "./virtual-page-view";

type GoogleAnalyticsPageViewProps = {
  readonly measurementId: string;
};

type GtagArguments =
  | [command: "js", startedAt: Date]
  | [command: "config", targetId: string, config: Record<string, string>];

type GoogleAnalyticsWindow = AnalyticsWindow & {
  gtag?: (..._args: GtagArguments) => void;
};

export function GoogleAnalyticsPageView({ measurementId }: GoogleAnalyticsPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSensitivePath(pathname)) return;
    const currentUrl = sanitizeAnalyticsUrl(window.location.href);
    if (!currentUrl) return;

    if (currentUrlRef.current === currentUrl) {
      return;
    }

    const previousUrl = currentUrlRef.current;
    currentUrlRef.current = currentUrl;
    if (previousUrl !== null && isSilentVirtualPageView(currentUrl)) return;
    const safeUrl = new URL(currentUrl);
    const analyticsWindow = window as GoogleAnalyticsWindow;
    if (!analyticsWindow.gtag) {
      const dataLayer = (analyticsWindow.dataLayer ??= []);
      analyticsWindow.gtag = function gtag(..._args: GtagArguments) {
        // eslint-disable-next-line prefer-rest-params -- Keep the queue format from the Google tag snippet.
        dataLayer.push(arguments);
      };
      analyticsWindow.gtag("js", new Date());
    }

    analyticsWindow.gtag("config", measurementId, {
      page_location: currentUrl,
      page_path: `${safeUrl.pathname}${safeUrl.search}`,
      page_referrer: previousUrl ?? sanitizeAnalyticsUrl(document.referrer),
      page_title: document.title,
    });
  }, [measurementId, pathname, searchParams]);

  return null;
}
