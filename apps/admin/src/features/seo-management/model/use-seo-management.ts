"use client";

import { useCallback } from "react";

import { useCategories, useProducts } from "@/entities/products";
import { useSeoEntries } from "@/entities/seo";

export function useSeoManagement() {
  const {
    entries,
    isError: isEntriesError,
    isPending: isEntriesPending,
    refetch: refetchEntries,
  } = useSeoEntries();
  const {
    categories,
    isError: isCategoriesError,
    isPending: isCategoriesPending,
    refetch: refetchCategories,
  } = useCategories();
  const {
    isError: isProductsError,
    isPending: isProductsPending,
    products,
    refetch: refetchProducts,
  } = useProducts();
  const refreshSeoView = useCallback(async () => {
    await Promise.all([refetchEntries(), refetchProducts(), refetchCategories()]);
  }, [refetchCategories, refetchEntries, refetchProducts]);

  return {
    categories,
    entries,
    isError: isEntriesError || isProductsError || isCategoriesError,
    isPending: isEntriesPending || isProductsPending || isCategoriesPending,
    products,
    refreshSeoView,
  };
}
