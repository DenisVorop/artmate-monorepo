import { queryOptions } from "@tanstack/react-query";

import { getHomeData } from "@/shared/actions/home";
import type { ApiResultDTO } from "@/shared/lib/api-result";

import type { HomeData } from "@/entities/home/model";

export type HomeDataResult = ApiResultDTO<HomeData>;

const baseKey = "home";

export const homeQuery = {
  baseKey: [baseKey],
  getData: () =>
    queryOptions({
      queryKey: [baseKey, "data"] as const,
      queryFn: () => getHomeData(),
      staleTime: Infinity,
    }),
};
