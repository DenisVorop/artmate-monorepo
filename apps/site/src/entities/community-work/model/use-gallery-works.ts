"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
  const works = useMemo(
    () => [
      ...new Map(
        (data?.pages.flatMap((page) => page.works) ?? []).map((work) => [work.publicId, work]),
      ).values(),
    ],
    [data],
  );

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
