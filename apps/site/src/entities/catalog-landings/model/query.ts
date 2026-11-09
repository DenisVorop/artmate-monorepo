import { queryOptions } from "@tanstack/react-query";

import {
  getCatalogLandingPage,
  getCatalogLandingLinks,
  type CatalogLandingLink,
} from "@/shared/actions/catalog-landings";
import { ApiResult } from "@/shared/lib/api-result";

import type { CatalogLandingPage } from "./types";

export type CatalogLandingPageResult = CatalogLandingPage | null;
export type CatalogLandingLinksResult = CatalogLandingLink[] | null;

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
  getLinks: () =>
    queryOptions({
      queryKey: [baseKey, "links"] as const,
      queryFn: async () => ApiResult.fromDTO(await getCatalogLandingLinks()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
