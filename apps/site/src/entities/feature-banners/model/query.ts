import { queryOptions } from "@tanstack/react-query";

import { getFeatureBanners } from "@/shared/actions/feature-banners";
import { ApiResult } from "@/shared/lib/api-result";

import type { FeatureBannersDataResult } from "./types";

const featureBannersStaleTimeMs = 1000 * 30;

export const featureBannersQueryKeys = {
  all: ["feature-banners"] as const,
  list: () => [...featureBannersQueryKeys.all, "list"] as const,
};

export const featureBannersQuery = {
  list: () =>
    queryOptions({
      queryKey: featureBannersQueryKeys.list(),
      queryFn: async (): Promise<FeatureBannersDataResult> =>
        ApiResult.fromDTO(await getFeatureBanners()).unwrap() ?? [],
      staleTime: featureBannersStaleTimeMs,
      retryOnMount: false,
    }),
};
