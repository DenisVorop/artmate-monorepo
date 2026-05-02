"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  productsQueryKeys,
  useCategories,
  useProduct,
} from "@/entities/products";
import { routes } from "@/shared/constants";

type UseProductDetailsManagementParams = {
  readonly productId: string;
};

export function useProductDetailsManagement({
  productId,
}: UseProductDetailsManagementParams) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    isError: isProductError,
    isPending: isProductPending,
    product,
    refetch: refetchProduct,
  } = useProduct({
    productId,
  });
  const {
    categories,
    isError: isCategoriesError,
    isPending: isCategoriesPending,
    refetch: refetchCategories,
  } = useCategories();

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
      queryKey: productsQueryKeys.detail(productId),
    });
    router.push(routes.products);
  }, [productId, queryClient, router]);

  return {
    categories,
    handleProductDeleted,
    isError: isProductError || isCategoriesError,
    isPending: isProductPending || isCategoriesPending,
    product,
    refreshProductView,
  };
}
