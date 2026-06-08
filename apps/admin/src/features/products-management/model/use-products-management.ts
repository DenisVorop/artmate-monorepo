"use client";

import { useCallback } from "react";

import {
  useCategories,
  useProducts,
  useTags,
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
  const {
    isError: isTagsError,
    isPending: isTagsPending,
    refetch: refetchTags,
    tags,
  } = useTags();
  const refreshProductsView = useCallback(async () => {
    await Promise.all([refetchProducts(), refetchCategories(), refetchTags()]);
  }, [refetchCategories, refetchProducts, refetchTags]);

  return {
    categories,
    isError: isProductsError || isCategoriesError || isTagsError,
    isPending: isProductsPending || isCategoriesPending || isTagsPending,
    products,
    refreshProductsView,
    tags,
  };
}
