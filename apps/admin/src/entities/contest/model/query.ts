import { queryOptions } from "@tanstack/react-query";
import { getContest, getContests } from "@/shared/actions/contests";
export const contestsQueryKeys = {
  all: ["admin-contests"] as const,
  list: () => ["admin-contests", "list"] as const,
  detail: (id: string) => ["admin-contests", "detail", id] as const,
};
export const contestsQuery = {
  list: () =>
    queryOptions({
      queryKey: contestsQueryKeys.list(),
      queryFn: getContests,
      staleTime: 30_000,
      refetchInterval: 60_000,
      retryOnMount: false,
    }),
  detail: (id: string) =>
    queryOptions({
      queryKey: contestsQueryKeys.detail(id),
      queryFn: () => getContest(id),
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
