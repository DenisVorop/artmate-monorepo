"use client";

import { useCallback } from "react";

import type { Product } from "@/entities/products";

import { useAddCartItemMutation } from "./use-add-cart-item";

export function useAddProductToCart() {
  const { mutate } = useAddCartItemMutation();

  return useCallback(
    async (product: Product, quantity = 1) => {
      await mutate({
        productId: product.id,
        quantity,
      });
    },
    [mutate],
  );
}
