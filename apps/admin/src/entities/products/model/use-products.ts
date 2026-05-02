"use client";

import { useQuery } from "@tanstack/react-query";

import { productsQuery } from "./query";

export function useProducts() {
  const { data, isError, isPending, refetch } = useQuery(productsQuery.list());

  return {
    isError,
    isPending,
    products: data ?? [],
    refetch,
  };
}
