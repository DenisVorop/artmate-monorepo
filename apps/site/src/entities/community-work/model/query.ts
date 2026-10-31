import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  getCommunityGalleryWorks,
  getCommunityGalleryFilters,
  getCommunityWorksForColoring,
  getCommunityWorksForCollection,
  getPublicCommunityWork,
  getPublicWorkshop,
} from "@/shared/actions/workshops";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import {
  collectionWorksPageSchema,
  communityWorksSchema,
  galleryWorksPageSchema,
  galleryFiltersSchema,
  publicCommunityWorkSchema,
  publicWorkshopSchema,
} from "./schemas";
import type { GalleryWorksFilters } from "./types";

const baseKey = "community-work";

export const communityWorkQuery = {
  baseKey: [baseKey] as const,
  galleryFilters: () =>
    queryOptions({
      queryKey: [baseKey, "gallery-filters"] as const,
      queryFn: async () => galleryFiltersSchema.parse(unwrap(await getCommunityGalleryFilters())),
      staleTime: 60_000,
      retryOnMount: false,
    }),
  gallery: (filters: GalleryWorksFilters = {}) =>
    infiniteQueryOptions({
      queryKey: [
        baseKey,
        "gallery",
        [...(filters.collections ?? [])].sort(),
        filters.number ?? null,
      ] as const,
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) =>
        galleryWorksPageSchema.parse(unwrap(await getCommunityGalleryWorks(pageParam, filters))),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 60_000,
      retryOnMount: false,
    }),
  workshop: (handle: string) =>
    queryOptions({
      queryKey: [baseKey, "workshop", handle] as const,
      queryFn: async () => publicWorkshopSchema.parse(unwrap(await getPublicWorkshop(handle))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  work: (publicId: string) =>
    queryOptions({
      queryKey: [baseKey, "work", publicId] as const,
      queryFn: async () =>
        publicCommunityWorkSchema.parse(unwrap(await getPublicCommunityWork(publicId))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  forColoring: (slug: string, number: number) =>
    queryOptions({
      queryKey: [baseKey, "coloring", slug, number] as const,
      queryFn: async () =>
        communityWorksSchema.parse(unwrap(await getCommunityWorksForColoring(slug, number))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  forCollection: (slug?: string) =>
    infiniteQueryOptions({
      queryKey: [baseKey, "collection", slug] as const,
      enabled: Boolean(slug),
      initialPageParam: undefined as string | undefined,
      queryFn: async ({ pageParam }) =>
        collectionWorksPageSchema.parse(
          unwrap(await getCommunityWorksForCollection(slug!, pageParam)),
        ),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      staleTime: 60_000,
      retryOnMount: false,
    }),
  featuredForCollections: (slugs: readonly string[]) =>
    queryOptions({
      queryKey: [baseKey, "featured-collections", slugs] as const,
      queryFn: async () => {
        const pages = await Promise.all(
          slugs.map(async (slug) =>
            collectionWorksPageSchema.parse(unwrap(await getCommunityWorksForCollection(slug))),
          ),
        );
        return pages.flatMap((page) => page.works.slice(0, 1));
      },
      staleTime: 60_000,
      retryOnMount: false,
    }),
};

function unwrap(result: ApiResultDTO<unknown>) {
  return ApiResult.fromDTO(result).unwrap();
}
