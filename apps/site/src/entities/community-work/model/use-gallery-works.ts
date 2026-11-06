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
  const { works, workPages } = useMemo(() => {
    const byId = new Map(
      (data?.pages.flatMap((page) => page.works) ?? []).map((work) => [work.publicId, work]),
    );
    const seen = new Set<string>();
    const workPages = (data?.pages ?? []).map((page) =>
      page.works.flatMap((work) => {
        if (seen.has(work.publicId)) return [];
        seen.add(work.publicId);
        return [byId.get(work.publicId)!];
      }),
    );
    return { works: [...byId.values()], workPages };
  }, [data]);

  return {
    works,
    workPages,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  };
}
