"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";

export function useCollectionCommunityWorks(slug?: string) {
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useInfiniteQuery(communityWorkQuery.forCollection(slug));
  const works = [
    ...new Map(
      (data?.pages.flatMap((page) => page.works) ?? []).map((work) => [work.publicId, work]),
    ).values(),
  ];

  return { works, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage };
}
