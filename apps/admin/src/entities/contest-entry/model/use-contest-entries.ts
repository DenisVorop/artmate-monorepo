"use client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ContestEntryStatus } from "@/shared/actions/contest-entries";
import { contestEntriesQuery } from "./query";
export function useContestEntries(
  contestId: string,
  status: ContestEntryStatus | "all",
) {
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(contestEntriesQuery.list(contestId, status));
  return {
    entries: data?.pages.flatMap((page) => page.entries) ?? [],
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  };
}
export function useContestEntry(id: string) {
  const { data, isPending, isError, refetch } = useQuery(
    contestEntriesQuery.detail(id),
  );
  return { entry: data, isPending, isError, refetch };
}
export function useContestEntryPhoto(id: string, revisionId: string) {
  const { data, isPending, isError, refetch } = useQuery(
    contestEntriesQuery.photo(id, revisionId),
  );
  return { photoUrl: data, isPending, isError, refetch };
}
