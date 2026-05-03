"use client";

import { useQuery } from "@tanstack/react-query";

import { blogQuery } from "./query";

export function useBlogCategories() {
  const { data, isError, isPending, refetch } = useQuery(
    blogQuery.categories(),
  );

  return {
    categories: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
