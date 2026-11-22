import { queryOptions } from "@tanstack/react-query";
import { getContest, getContests } from "@/shared/actions/contests";
import { ApiResult } from "@/shared/lib/api-result";
const baseKey = ["contests"] as const;
export const contestsQuery = {
  baseKey,
  list: () =>
    queryOptions({
      queryKey: [...baseKey, "list"] as const,
      queryFn: async () => ApiResult.fromDTO(await getContests()).unwrap() ?? [],
      staleTime: 30_000,
      retryOnMount: false,
      refetchInterval: 60_000,
    }),
  detail: (slug: string) =>
    queryOptions({
      queryKey: [...baseKey, "detail", slug] as const,
      queryFn: async () => ApiResult.fromDTO(await getContest(slug)).unwrap() ?? null,
      staleTime: 30_000,
      retryOnMount: false,
      refetchInterval: 60_000,
    }),
};
