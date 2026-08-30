import { queryOptions } from "@tanstack/react-query";

import {
  getAdminColoring,
  getAdminColorings,
  getColoringRevisions,
  getProtectedColoringAsset,
} from "@/shared/actions/colorings";

const coloringsStaleTimeMs = 1000 * 60 * 5;

export const coloringsQueryKeys = {
  all: ["admin-colorings"] as const,
  asset: (previewUrl: string) =>
    [...coloringsQueryKeys.all, "asset", previewUrl] as const,
  details: () => [...coloringsQueryKeys.all, "detail"] as const,
  detail: (coloringId: string) =>
    [...coloringsQueryKeys.details(), coloringId] as const,
  list: () => [...coloringsQueryKeys.all, "list"] as const,
  revisions: (coloringId: string) =>
    [...coloringsQueryKeys.detail(coloringId), "revisions"] as const,
};

export const coloringsQuery = {
  asset: (previewUrl: string) =>
    queryOptions({
      queryKey: coloringsQueryKeys.asset(previewUrl),
      queryFn: () => getProtectedColoringAsset(previewUrl),
      staleTime: coloringsStaleTimeMs,
      retryOnMount: false,
    }),
  detail: (coloringId: string) =>
    queryOptions({
      queryKey: coloringsQueryKeys.detail(coloringId),
      queryFn: () => getAdminColoring(coloringId),
      staleTime: coloringsStaleTimeMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: coloringsQueryKeys.list(),
      queryFn: getAdminColorings,
      staleTime: coloringsStaleTimeMs,
      retryOnMount: false,
    }),
  revisions: (coloringId: string) =>
    queryOptions({
      queryKey: coloringsQueryKeys.revisions(coloringId),
      queryFn: () => getColoringRevisions(coloringId),
      staleTime: coloringsStaleTimeMs,
      retryOnMount: false,
    }),
};
