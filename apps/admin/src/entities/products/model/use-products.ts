"use client";

import { useQuery } from "@tanstack/react-query";

import { getAdminProducts } from "@/shared/actions/products";

import { productsQueryKeys } from "./query";
import type { Product } from "./types";

type UseProductsParams = {
  readonly initialData: readonly Product[];
};

export function useProducts({ initialData }: UseProductsParams) {
  const { data, isError, isPending, refetch } = useQuery({
    initialData: [...initialData],
    queryFn: getAdminProducts,
    queryKey: productsQueryKeys.list(),
  });

  return {
    isError,
    isPending,
    products: data,
    refetch,
  };
}
