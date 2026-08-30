"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "./query";

type UseColoringCollectionParams = {
  readonly collectionId: string;
};

export function useColoringCollection({
  collectionId,
}: UseColoringCollectionParams) {
  const { data, isError, isPending, refetch } = useQuery(
    coloringCollectionsQuery.detail(collectionId),
  );

  return {
    collection: data,
    isError,
    isPending,
    refetch,
  };
}
