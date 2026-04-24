import { queryOptions } from "@tanstack/react-query";

import { getHomeData } from "@/shared/actions/home";
import { ensureApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import type { HomeData } from "./types";

export type HomeDataResult = ApiResultDTO<HomeData>;

const baseKey = "home";

export const homeQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: async () => ensureApiResult(await getHomeData()),
      staleTime: Infinity,
    }),
};
