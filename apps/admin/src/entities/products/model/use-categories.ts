"use client";

import { useQuery } from "@tanstack/react-query";

import { productsQuery } from "./query";

export function useCategories() {
  const { data, isError, isPending, refetch } = useQuery(productsQuery.categories());

  return {
    categories: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
