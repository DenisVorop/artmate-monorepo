import { queryOptions } from "@tanstack/react-query";
import { getContestDraw } from "@/shared/actions/contests";
export const contestDrawQuery = {
  detail: (id: string) =>
    queryOptions({
      queryKey: ["admin-contest-draw", id],
      queryFn: () => getContestDraw(id),
      staleTime: 0,
      retryOnMount: false,
      refetchInterval: 30_000,
    }),
};
