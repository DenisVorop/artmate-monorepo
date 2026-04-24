import { queryOptions } from "@tanstack/react-query";

import { getHomeData } from "@/shared/actions/home";
import { ApiResult } from "@/shared/lib/api-result";

import type { HomeData } from "./types";

export type HomeDataResult = HomeData | null;

const baseKey = "home";

export const homeQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ApiResult.fromDTO(await getHomeData()).unwrap() ?? null,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
