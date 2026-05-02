"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  productsQueryKeys,
  useCategories,
  useProduct,
  type Product,
  type ProductCategory,
} from "@/entities/products";
import { routes } from "@/shared/constants";

type UseProductDetailsManagementParams = {
  readonly categories: readonly ProductCategory[];
  readonly product: Product;
};

export function useProductDetailsManagement({
  categories: initialCategories,
  product: initialProduct,
}: UseProductDetailsManagementParams) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    isError: isProductError,
    product,
    refetch: refetchProduct,
  } = useProduct({
    initialData: initialProduct,
    productId: initialProduct.id,
  });
  const {
    categories,
    isError: isCategoriesError,
    refetch: refetchCategories,
  } = useCategories({
    initialData: initialCategories,
  });

  const refreshProductView = useCallback(async () => {
    await Promise.all([
      refetchProduct(),
      refetchCategories(),
      queryClient.invalidateQueries({
        queryKey: productsQueryKeys.list(),
      }),
    ]);
  }, [queryClient, refetchCategories, refetchProduct]);

  const handleProductDeleted = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: productsQueryKeys.list(),
    });
    queryClient.removeQueries({
      queryKey: productsQueryKeys.detail(initialProduct.id),
    });
    router.push(routes.products);
  }, [initialProduct.id, queryClient, router]);

  return {
    categories,
    handleProductDeleted,
    isError: isProductError || isCategoriesError,
    product,
    refreshProductView,
  };
}
