"use client";

import { useCallback } from "react";

import {
  useCategories,
  useProducts,
  type Product,
  type ProductCategory,
} from "@/entities/products";

type UseProductsManagementParams = {
  readonly categories: readonly ProductCategory[];
  readonly products: readonly Product[];
};

export function useProductsManagement({
  categories: initialCategories,
  products: initialProducts,
}: UseProductsManagementParams) {
  const { products, refetch: refetchProducts } = useProducts({
    initialData: initialProducts,
  });
  const { categories, refetch: refetchCategories } = useCategories({
    initialData: initialCategories,
  });
  const refreshProductsView = useCallback(async () => {
    await Promise.all([refetchProducts(), refetchCategories()]);
  }, [refetchCategories, refetchProducts]);

  return {
    categories,
    products,
    refreshProductsView,
  };
}
