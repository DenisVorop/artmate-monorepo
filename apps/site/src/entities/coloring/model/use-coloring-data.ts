"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringQuery } from "./query";

export function useColoringData(
  collectionSlug: string,
  number: number,
  publishedRevisionId: string,
) {
  const { data, error, isError, isPending, refetch } = useQuery(
    coloringQuery.getDetail(collectionSlug, number, publishedRevisionId),
  );

  return {
    coloring: data,
    error,
    isError,
    isPending,
    refetch,
  };
}
