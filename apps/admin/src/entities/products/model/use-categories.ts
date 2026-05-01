"use client";

import { useQuery } from "@tanstack/react-query";

import { getProductCategories } from "@/shared/actions/products";

import { productsQueryKeys } from "./query";
import type { ProductCategory } from "./types";

type UseCategoriesParams = {
  readonly initialData: readonly ProductCategory[];
};

export function useCategories({ initialData }: UseCategoriesParams) {
  const { data, isError, isPending, refetch } = useQuery({
    initialData: [...initialData],
    queryFn: getProductCategories,
    queryKey: productsQueryKeys.categories(),
  });

  return {
    categories: data,
    isError,
    isPending,
    refetch,
  };
}
