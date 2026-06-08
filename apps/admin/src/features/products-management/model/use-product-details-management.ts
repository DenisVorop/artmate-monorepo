"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import {
  productsQueryKeys,
  useCategories,
  useProduct,
  useTags,
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
  const {
    isError: isTagsError,
    isPending: isTagsPending,
    refetch: refetchTags,
    tags,
  } = useTags();

  const refreshProductView = useCallback(async () => {
    await Promise.all([
      refetchProduct(),
      refetchCategories(),
      refetchTags(),
      queryClient.invalidateQueries({
        queryKey: productsQueryKeys.list(),
      }),
    ]);
  }, [queryClient, refetchCategories, refetchProduct, refetchTags]);

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
    isError: isProductError || isCategoriesError || isTagsError,
    isPending: isProductPending || isCategoriesPending || isTagsPending,
    product,
    refreshProductView,
    tags,
  };
}
