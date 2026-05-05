import { queryOptions } from "@tanstack/react-query";

import { getSeoEntries, getSeoSnapshots } from "@/shared/actions/seo";

const seoStaleTimeMs = 1000 * 60 * 5;

export const seoQueryKeys = {
  all: ["admin-seo"] as const,
  list: () => [...seoQueryKeys.all, "list"] as const,
  snapshots: (entryId: string) =>
    [...seoQueryKeys.all, "snapshots", entryId] as const,
};

export const seoQuery = {
  list: () =>
    queryOptions({
      queryKey: seoQueryKeys.list(),
      queryFn: getSeoEntries,
      staleTime: seoStaleTimeMs,
      retryOnMount: false,
    }),
  snapshots: (entryId: string) =>
    queryOptions({
      queryKey: seoQueryKeys.snapshots(entryId),
      queryFn: () => getSeoSnapshots(entryId),
      staleTime: seoStaleTimeMs,
      retryOnMount: false,
      enabled: Boolean(entryId),
    }),
};
