"use client";

import { useQuery } from "@tanstack/react-query";

import { getAdminProduct } from "@/shared/actions/products";

import { productsQueryKeys } from "./query";
import type { Product } from "./types";

type UseProductParams = {
  readonly initialData: Product;
  readonly productId: string;
};

export function useProduct({ initialData, productId }: UseProductParams) {
  const { data, isError, isPending, refetch } = useQuery({
    initialData,
    queryFn: () => getAdminProduct(productId),
    queryKey: productsQueryKeys.detail(productId),
  });

  return {
    isError,
    isPending,
    product: data,
    refetch,
  };
}
