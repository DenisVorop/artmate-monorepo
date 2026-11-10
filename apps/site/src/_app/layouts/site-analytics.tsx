"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { useCookieConsent } from "@/shared/lib/cookie-consent";

import {
  getNavigationDestination,
  getSiteAction,
  getSiteArea,
  getSiteSection,
  siteAnalytics,
} from "../lib/site-analytics";

const scrollMilestones = [25, 50, 75, 100] as const;
export function SiteAnalytics() {
  const pathname = usePathname();
  const { isAccepted } = useCookieConsent();

  useEffect(() => {
    if (!isAccepted) return;
    const currentSection = getSiteSection(pathname);
    if (!currentSection) return;
    const pageSection = currentSection;
    const section = () =>
      document.querySelector("[data-site-product-page]") ? "product" : pageSection;
    let reached = 0;
    let frame = 0;
    let previousScroll = window.scrollY;

    function onScroll() {
      if (frame || document.visibilityState !== "visible") return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scroll = window.scrollY;
        const movingDown = scroll > previousScroll;
        previousScroll = scroll;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        if (!movingDown || scrollable <= 0) return;
        const progress = ((scroll + 1) / scrollable) * 100;

        for (const percent of scrollMilestones) {
          if (percent > reached && percent <= progress) {
            reached = percent;
            siteAnalytics.send("scroll", { section: section(), percent });
          }
        }
      });
    }

    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        (event.button !== 0 && event.button !== 1) ||
        !(event.target instanceof Element)
      )
        return;

      const control = event.target.closest("a[href],button,[role='button'],[data-site-action]");
      if (!control || control.closest("[disabled],[aria-disabled='true'],[inert]")) return;

      const action = getSiteAction(control.getAttribute("data-site-action"));
      const closingAnswer =
        action === "faq_answer_open" && control.getAttribute("aria-expanded") === "true";
      if (action && !closingAnswer)
        siteAnalytics.send("interaction", { section: section(), action });
      if (!(control instanceof HTMLAnchorElement) || control.hasAttribute("download")) return;

      const destination = getNavigationDestination(
        control.href,
        window.location,
        control.hasAttribute("data-site-product-link"),
      );
      if (!destination) return;
      const placement = getSiteArea(
        control.closest("[data-site-area]")?.getAttribute("data-site-area"),
      );
      siteAnalytics.send("navigation", {
        from_section: section(),
        to_section: destination,
        placement,
      });
    }

    // Capture before Next Link prevents the default action for SPA navigation.
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [isAccepted, pathname]);

  return null;
}
