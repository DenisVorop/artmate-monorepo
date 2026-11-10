"use client";

import { useEffect, useRef } from "react";

import type { Product } from "@/entities/products";

import { useAnalytics, type ProductListPlacement } from "./analytics";

const callbacks = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function refreshVisibleCards() {
  if (document.visibilityState !== "visible") return;
  for (const card of callbacks.keys()) {
    observer?.unobserve(card);
    observer?.observe(card);
  }
}

function observeCard(card: Element, onVisible: () => void) {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        if (document.visibilityState !== "visible") return;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            callbacks.get(entry.target)?.();
          }
        }
      },
      { threshold: 0.25 },
    );
    document.addEventListener("visibilitychange", refreshVisibleCards);
  }

  callbacks.set(card, onVisible);
  observer.observe(card);
  return () => {
    if (callbacks.get(card) !== onVisible) return;
    observer?.unobserve(card);
    callbacks.delete(card);
    if (callbacks.size === 0) {
      observer?.disconnect();
      observer = undefined;
      document.removeEventListener("visibilitychange", refreshVisibleCards);
    }
  };
}

export function useProductImpression(
  product: Product,
  list: ProductListPlacement,
  position?: number,
) {
  const cardRef = useRef<HTMLDivElement>(null);
  const lastImpression = useRef<string | null>(null);
  const analytics = useAnalytics();
  const placement = JSON.stringify([list, position, product.id]);

  useEffect(() => {
    const card = cardRef.current;
    if (
      !card ||
      typeof IntersectionObserver !== "function" ||
      lastImpression.current === placement
    ) {
      return;
    }

    const stop = observeCard(card, () => {
      lastImpression.current = placement;
      stop();
      analytics.productShown(product, { list, position });
    });
    return stop;
  }, [analytics, list, placement, position, product]);

  return cardRef;
}
