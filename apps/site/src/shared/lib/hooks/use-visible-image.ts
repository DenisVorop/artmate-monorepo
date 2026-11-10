"use client";

import { useEffect, useRef, type RefObject } from "react";

import { useCookieConsent } from "@/shared/lib/cookie-consent";

const observations = new Map<Element, (_visible: boolean) => void>();
let observer: IntersectionObserver | undefined;

function observe(element: Element, onVisibility: (_visible: boolean) => void) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        observations.get(entry.target)?.(entry.isIntersecting && entry.intersectionRatio >= 0.25);
      }
    },
    { threshold: 0.25 },
  );
  observations.set(element, onVisibility);
  observer.observe(element);
  return () => {
    if (observations.get(element) !== onVisibility) return;
    observer?.unobserve(element);
    observations.delete(element);
    if (!observations.size) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}

export function useVisibleImage(
  target: RefObject<Element | null>,
  viewKey: string | number,
  onView: () => void,
  enabled = true,
) {
  const { isAccepted } = useCookieConsent();
  const lastView = useRef<string | number | null>(null);
  const reportView = useRef(onView);

  useEffect(() => {
    reportView.current = onView;
  }, [onView]);

  useEffect(() => {
    if (!enabled) {
      lastView.current = null;
      return;
    }
    const element = target.current;
    if (
      !isAccepted ||
      !element ||
      typeof IntersectionObserver !== "function" ||
      lastView.current === viewKey
    )
      return;

    let visible = false;
    const reportIfReady = () => {
      if (!visible || document.visibilityState !== "visible") return;
      const image = element instanceof HTMLImageElement ? element : element.querySelector("img");
      if (!image?.complete || !image.naturalWidth || lastView.current === viewKey) return;
      lastView.current = viewKey;
      stopWatching();
      reportView.current();
    };
    const unobserve = observe(element, (isVisible) => {
      visible = isVisible;
      reportIfReady();
    });
    const stopWatching = () => {
      unobserve();
      element.removeEventListener("load", reportIfReady, true);
      document.removeEventListener("visibilitychange", reportIfReady);
    };
    element.addEventListener("load", reportIfReady, true);
    document.addEventListener("visibilitychange", reportIfReady);
    return stopWatching;
  }, [enabled, isAccepted, target, viewKey]);
}
