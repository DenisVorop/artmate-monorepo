"use client";

import { useEffect, useRef } from "react";

import type { Product } from "@/entities/products";

import { useAnalytics } from "./analytics";

let productViewSequence = 0;

export function useTrackProductView(product: Product | undefined) {
  const analytics = useAnalytics();
  const viewRef = useRef<{ key: string; productId: string } | undefined>(undefined);

  useEffect(() => {
    if (!product) {
      return;
    }

    if (viewRef.current?.productId !== product.id) {
      productViewSequence += 1;
      viewRef.current = {
        key: `${product.id}:${productViewSequence}`,
        productId: product.id,
      };
    }

    analytics.productViewed(product, viewRef.current.key);
  }, [analytics, product]);
}
