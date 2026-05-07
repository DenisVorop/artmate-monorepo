"use client";

import { useEffect, useState } from "react";
import { Check, Cookie } from "lucide-react";

import { routes } from "@/shared/constants";
import { Button } from "@/shared/ui";
import { Link } from "@/shared/ui/link";

import { cookieConsentAcceptedValue, cookieConsentStorageKey } from "../lib/consent-storage";

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      setIsVisible(localStorage.getItem(cookieConsentStorageKey) !== cookieConsentAcceptedValue);
    } catch {
      setIsVisible(true);
    }
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem(cookieConsentStorageKey, cookieConsentAcceptedValue);
    } catch {
      // The current session can still hide the banner if storage is unavailable.
    }

    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <section
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
          onClick={handleAccept}
          className="h-8 w-full border-stone-200 bg-white px-2.5 text-xs text-stone-800 hover:bg-stone-50 focus-visible:border-rose-200 focus-visible:ring-rose-200/40 md:h-9 md:w-auto md:px-2.5 md:text-sm"
        >
          <Check data-icon="inline-start" aria-hidden="true" />
          Принять
        </Button>
      </div>
    </section>
  );
}
