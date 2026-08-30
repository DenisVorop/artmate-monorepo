"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "./query";

export function useColoringCollections() {
  const { data, isError, isPending, refetch } = useQuery(
    coloringCollectionsQuery.list(),
  );

  return {
    collections: data ?? [],
    isError,
    isPending,
    refetch,
  };
}
