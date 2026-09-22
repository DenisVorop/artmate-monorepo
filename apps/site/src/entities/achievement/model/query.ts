import { queryOptions } from "@tanstack/react-query";

import { getMyAchievements } from "@/shared/actions/achievements";
import { ApiResult } from "@/shared/lib/api-result";

import { achievementsSchema } from "./types";

export const achievementQuery = {
  baseKey: ["achievements"] as const,
  list: (userId: string) =>
    queryOptions({
      queryKey: ["achievements", userId] as const,
      queryFn: async ({ signal }) => {
        const result = await getMyAchievements(userId);
        signal.throwIfAborted();
        return achievementsSchema.parse(ApiResult.fromDTO(result).unwrap());
      },
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: false,
      retryOnMount: false,
    }),
};
