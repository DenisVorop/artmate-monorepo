"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "./query";

export function useColoringCollectionsData() {
  const { data, isError, isPending, refetch } = useQuery(coloringCollectionsQuery.getList());

  return { collections: data, isError, isPending, refetch };
}
