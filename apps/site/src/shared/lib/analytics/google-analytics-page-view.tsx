"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { isSensitivePath } from "../is-sensitive-path";
import { sanitizeAnalyticsUrl } from "./sanitize-analytics-url";

type GoogleAnalyticsPageViewProps = {
  readonly measurementId: string;
};

type GtagArguments = [
  command: string,
  targetId: string,
  config?: Record<string, string>,
];

type GoogleAnalyticsWindow = Window & {
  gtag?: (..._args: GtagArguments) => void;
};

export function GoogleAnalyticsPageView({
  measurementId,
}: GoogleAnalyticsPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSensitivePath(pathname)) return;
    const currentUrl = sanitizeAnalyticsUrl(window.location.href);
    if (!currentUrl) return;

    if (currentUrlRef.current === null) {
      currentUrlRef.current = currentUrl;
      return;
    }

    if (currentUrlRef.current === currentUrl) {
      return;
    }

    currentUrlRef.current = currentUrl;
    const safeUrl = new URL(currentUrl);

    (window as GoogleAnalyticsWindow).gtag?.("config", measurementId, {
      page_location: currentUrl,
      page_path: `${safeUrl.pathname}${safeUrl.search}`,
    });
  }, [measurementId, pathname, searchParams]);

  return null;
}
