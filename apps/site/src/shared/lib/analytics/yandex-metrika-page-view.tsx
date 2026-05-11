"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type YandexMetrikaPageViewProps = {
  readonly counterId: number;
};

type YandexMetrikaWindow = Window & {
  ym?: (..._args: unknown[]) => void;
};

export function YandexMetrikaPageView({ counterId }: YandexMetrikaPageViewProps) {
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
    (window as YandexMetrikaWindow).ym?.(counterId, "hit", currentUrl);
  }, [counterId, pathname, searchParams]);

  return null;
}
