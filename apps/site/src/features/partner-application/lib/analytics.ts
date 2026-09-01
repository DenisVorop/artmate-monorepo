import { getCookieConsentSnapshot } from "@/shared/lib/cookie-consent";

export type PartnerProgramEvent =
  | "partner_cta_click"
  | "partner_form_error"
  | "partner_form_start"
  | "partner_form_success";

type AnalyticsWindow = Window & {
  gtag?: (..._args: unknown[]) => void;
  ym?: (..._args: unknown[]) => void;
};

export function trackPartnerProgramEvent(eventName: PartnerProgramEvent) {
  if (typeof window === "undefined" || !getCookieConsentSnapshot()) {
    return;
  }

  const analyticsWindow = window as AnalyticsWindow;
  analyticsWindow.gtag?.("event", eventName, {
    event_category: "partner_program",
  });

  const rawCounterId =
    document.getElementById("yandex-metrika")?.dataset.counterId ??
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  const counterId = rawCounterId ? Number(rawCounterId) : 0;

  if (Number.isInteger(counterId) && counterId > 0) {
    analyticsWindow.ym?.(counterId, "reachGoal", eventName);
  }
}
