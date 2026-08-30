"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "./query";

export function useColoringCollectionData(slug: string) {
  const { data, isError, isPending, refetch } = useQuery(
    coloringCollectionsQuery.getDetail(slug),
  );

  return { collection: data, isError, isPending, refetch };
}
