"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringVariantsQuery } from "./query";

export function useColoringVariantsData(collectionSlug: string, number: number, token: string) {
  const { data, error, isError, isPending, refetch } = useQuery(
    coloringVariantsQuery.getDetail(collectionSlug, number, token),
  );

  return {
    coloring: data,
    error,
    isError,
    isPending,
    refetch,
  };
}
