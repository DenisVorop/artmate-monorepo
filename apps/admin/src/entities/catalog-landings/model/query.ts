import { queryOptions } from "@tanstack/react-query";

import {
  getCatalogLandingPage,
  getCatalogLandingPages,
} from "@/shared/actions/catalog-landings";

const catalogLandingsStaleTimeMs = 1000 * 60 * 5;

export const catalogLandingsQueryKeys = {
  all: ["admin-catalog-landings"] as const,
  detail: (landingId: string) =>
    [...catalogLandingsQueryKeys.all, "detail", landingId] as const,
  list: () => [...catalogLandingsQueryKeys.all, "list"] as const,
};

export const catalogLandingsQuery = {
  detail: (landingId: string) =>
    queryOptions({
      queryKey: catalogLandingsQueryKeys.detail(landingId),
      queryFn: () => getCatalogLandingPage(landingId),
      staleTime: catalogLandingsStaleTimeMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: catalogLandingsQueryKeys.list(),
      queryFn: getCatalogLandingPages,
      staleTime: catalogLandingsStaleTimeMs,
      retryOnMount: false,
    }),
};
