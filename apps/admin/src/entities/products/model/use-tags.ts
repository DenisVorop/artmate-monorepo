"use client";

import { useQuery } from "@tanstack/react-query";

import { productsQuery } from "./query";

export function useTags() {
  const { data, isError, isPending, refetch } = useQuery(productsQuery.tags());

  return {
    isError,
    isPending,
    refetch,
    tags: data ?? [],
  };
}
