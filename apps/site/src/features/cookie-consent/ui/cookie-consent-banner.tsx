"use client";

import { Check, Cookie } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

import { routes } from "@/shared/constants";
import { acceptCookieConsent, useCookieConsent } from "@/shared/lib/cookie-consent";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

export function CookieConsentBanner() {
  const { isAccepted, isReady } = useCookieConsent();
  const sectionRef = useRef<HTMLElement>(null);
  const isVisible = isReady && !isAccepted;

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const rootStyle = document.documentElement.style;
    const section = sectionRef.current;
    const resetHeight = () => rootStyle.removeProperty("--site-cookie-consent-height");

    if (!isVisible || !section) {
      resetHeight();
      return;
    }

    const updateHeight = () => {
      rootStyle.setProperty(
        "--site-cookie-consent-height",
        `${section.getBoundingClientRect().height}px`,
      );
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateHeight);

    updateHeight();
    resizeObserver?.observe(section);

    return () => {
      resizeObserver?.disconnect();
      resetHeight();
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Уведомление об использовании cookie"
      className="fixed right-0 bottom-0 left-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5 rounded-lg border border-stone-200 bg-white/95 p-2.5 text-stone-700 shadow-[0_18px_70px_rgb(28_25_23/0.14)] backdrop-blur sm:gap-3 sm:p-3 md:flex-row md:items-center md:justify-between md:gap-5 md:p-4">
        <div className="flex items-start gap-2.5 sm:gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500 sm:size-9">
            <Cookie className="size-3.5 sm:size-4" aria-hidden="true" />
          </div>
          <p className="text-xs leading-4 text-stone-600 sm:text-sm sm:leading-5">
            Сайт использует cookie и технические данные для работы сервиса. Нажимая
            «Принять», вы соглашаетесь с{" "}
            <Link
              href={routes.legal.cookiePolicy}
              className="font-semibold text-stone-900 underline underline-offset-4 hover:text-rose-600 focus-visible:text-rose-600"
            >
              Политикой Cookie
            </Link>{" "}
            и обработкой таких данных.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => acceptCookieConsent()}
          className="min-h-11 w-full border-stone-200 bg-white px-2.5 text-xs text-stone-800 hover:bg-stone-50 focus-visible:border-rose-200 focus-visible:ring-rose-200/40 md:w-auto md:px-2.5 md:text-sm"
        >
          <Check data-icon="inline-start" aria-hidden="true" />
          Принять
        </Button>
      </div>
    </section>
  );
}
