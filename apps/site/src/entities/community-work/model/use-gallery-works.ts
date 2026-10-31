"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";
import type { GalleryWorksFilters } from "./types";

export function useGalleryWorks(filters: GalleryWorksFilters = {}) {
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(communityWorkQuery.gallery(filters));
  const works = [
    ...new Map(
      (data?.pages.flatMap((page) => page.works) ?? []).map((work) => [work.publicId, work]),
    ).values(),
  ];

  return {
    works,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  };
}
