import { queryOptions } from "@tanstack/react-query";

import {
  getCatalogLandingPage,
  getCatalogLandingPages,
} from "@/shared/actions/catalog-landings";
import { ApiResult } from "@/shared/lib/api-result";

import type { CatalogLandingPage } from "./types";

export type CatalogLandingPageResult = CatalogLandingPage | null;
export type CatalogLandingPagesResult = CatalogLandingPage[] | null;

const baseKey = "catalog-landings";

export const catalogLandingsQuery = {
  baseKey: [baseKey],
  getDetail: (slug: string) =>
    queryOptions({
      queryKey: [baseKey, "detail", slug] as const,
      queryFn: async () => ApiResult.fromDTO(await getCatalogLandingPage(slug)).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
  getList: () =>
    queryOptions({
      queryKey: [baseKey, "list"] as const,
      queryFn: async () => ApiResult.fromDTO(await getCatalogLandingPages()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
