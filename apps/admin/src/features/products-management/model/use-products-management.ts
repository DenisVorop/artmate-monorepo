"use client";

import { useCallback } from "react";

import {
  useCategories,
  useProducts,
} from "@/entities/products";

export function useProductsManagement() {
  const {
    isError: isProductsError,
    isPending: isProductsPending,
    products,
    refetch: refetchProducts,
  } = useProducts();
  const {
    categories,
    isError: isCategoriesError,
    isPending: isCategoriesPending,
    refetch: refetchCategories,
  } = useCategories();
  const refreshProductsView = useCallback(async () => {
    await Promise.all([refetchProducts(), refetchCategories()]);
  }, [refetchCategories, refetchProducts]);

  return {
    categories,
    isError: isProductsError || isCategoriesError,
    isPending: isProductsPending || isCategoriesPending,
    products,
    refreshProductsView,
  };
}
