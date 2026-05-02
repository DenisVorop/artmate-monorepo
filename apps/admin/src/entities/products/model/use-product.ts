"use client";

import { useQuery } from "@tanstack/react-query";

import { productsQuery } from "./query";

type UseProductParams = {
  readonly productId: string;
};

export function useProduct({ productId }: UseProductParams) {
  const { data, isError, isPending, refetch } = useQuery(productsQuery.detail(productId));

  return {
    isError,
    isPending,
    product: data,
    refetch,
  };
}
