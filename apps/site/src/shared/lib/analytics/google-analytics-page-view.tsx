"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type GoogleAnalyticsPageViewProps = {
  readonly measurementId: string;
};

type GtagArguments = [command: string, targetId: string, config?: Record<string, string>];

type GoogleAnalyticsWindow = Window & {
  gtag?: (..._args: GtagArguments) => void;
};

export function GoogleAnalyticsPageView({ measurementId }: GoogleAnalyticsPageViewProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const currentUrl = window.location.href;

    if (currentUrlRef.current === null) {
      currentUrlRef.current = currentUrl;
      return;
    }

    if (currentUrlRef.current === currentUrl) {
      return;
    }

    currentUrlRef.current = currentUrl;
    const search = searchParams.toString();

    (window as GoogleAnalyticsWindow).gtag?.("config", measurementId, {
      page_location: currentUrl,
      page_path: `${pathname}${search ? `?${search}` : ""}`,
    });
  }, [measurementId, pathname, searchParams]);

  return null;
}
