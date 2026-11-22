import { queryOptions } from "@tanstack/react-query";
import { getMyPrize, getMyPrizes } from "@/shared/actions/prizes";
import { ApiResult } from "@/shared/lib/api-result";
export const prizesQuery = {
  baseKey: ["orders", "prizes"] as const,
  list: (owner: string) =>
    queryOptions({
      queryKey: ["orders", "prizes", owner, "list"] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyPrizes();
        signal.throwIfAborted();
        return ApiResult.fromDTO(result).unwrap()!;
      },
      staleTime: 30_000,
      retryOnMount: false,
      refetchInterval: 60_000,
    }),
  detail: (owner: string, id: string) =>
    queryOptions({
      queryKey: ["orders", "prizes", owner, "detail", id] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyPrize(id);
        signal.throwIfAborted();
        return ApiResult.fromDTO(result).unwrap();
      },
      staleTime: 30_000,
      retryOnMount: false,
    }),
};
