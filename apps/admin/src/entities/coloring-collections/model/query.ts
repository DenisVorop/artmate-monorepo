import { queryOptions } from "@tanstack/react-query";

import {
  getAdminColoringCollection,
  getAdminColoringCollections,
} from "@/shared/actions/colorings";

const coloringCollectionsStaleTimeMs = 1000 * 60 * 5;

export const coloringCollectionsQueryKeys = {
  all: ["admin-coloring-collections"] as const,
  detail: (collectionId: string) =>
    [...coloringCollectionsQueryKeys.all, "detail", collectionId] as const,
  list: () => [...coloringCollectionsQueryKeys.all, "list"] as const,
};

export const coloringCollectionsQuery = {
  detail: (collectionId: string) =>
    queryOptions({
      queryKey: coloringCollectionsQueryKeys.detail(collectionId),
      queryFn: () => getAdminColoringCollection(collectionId),
      staleTime: coloringCollectionsStaleTimeMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: coloringCollectionsQueryKeys.list(),
      queryFn: getAdminColoringCollections,
      staleTime: coloringCollectionsStaleTimeMs,
      retryOnMount: false,
    }),
};
