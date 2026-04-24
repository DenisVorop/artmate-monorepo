"use client";

import { useCallback } from "react";

import type { Product } from "@/entities/products";

import { useAddCartItemMutation } from "./use-add-cart-item";

export function useAddProductToCart() {
  const { mutate } = useAddCartItemMutation();

  return useCallback(
    async (product: Product, quantity = 1) => {
      await mutate({
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          price: product.price,
          category: product.category,
          categorySlug: product.categorySlug,
          image: product.image,
        },
        quantity,
      });
    },
    [mutate],
  );
}
