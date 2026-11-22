import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import {
  getContestEntries,
  getContestEntry,
  getContestEntryPhoto,
  type ContestEntryStatus,
} from "@/shared/actions/contest-entries";
export const contestEntriesQuery = {
  baseKey: ["admin-contest-entries"] as const,
  list: (contestId: string, status: ContestEntryStatus | "all") =>
    infiniteQueryOptions({
      queryKey: ["admin-contest-entries", "list", contestId, status],
      initialPageParam: undefined as string | undefined,
      queryFn: ({ pageParam }) =>
        getContestEntries(contestId, status, pageParam),
      getNextPageParam: (page) => page.nextCursor ?? undefined,
      staleTime: 15_000,
      refetchInterval: 30_000,
      retryOnMount: false,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: ["admin-contest-entries", "detail", id],
      queryFn: () => getContestEntry(id),
      staleTime: 0,
      retryOnMount: false,
    }),
  photo: (id: string, revisionId: string) =>
    queryOptions({
      queryKey: ["admin-contest-entries", "photo", id, revisionId],
      queryFn: () => getContestEntryPhoto(id, revisionId),
      enabled: Boolean(revisionId),
      staleTime: Infinity,
      retryOnMount: false,
      gcTime: 0,
    }),
};
