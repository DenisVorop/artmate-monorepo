import { queryOptions } from "@tanstack/react-query";

import { getFeatureBanners } from "@/shared/actions/feature-banners";
import { ApiResult } from "@/shared/lib/api-result";
import { featureBannersQueryKey } from "@/shared/lib/query-keys";

import type { FeatureBannersDataResult } from "./types";

const featureBannersStaleTimeMs = 1000 * 30;

export const featureBannersQueryKeys = {
  all: featureBannersQueryKey,
  list: (owner: string) => [...featureBannersQueryKey, "list", owner] as const,
};

export const featureBannersQuery = {
  list: (owner: string) =>
    queryOptions({
      queryKey: featureBannersQueryKeys.list(owner),
      queryFn: async (): Promise<FeatureBannersDataResult> =>
        ApiResult.fromDTO(await getFeatureBanners()).unwrap() ?? [],
      staleTime: featureBannersStaleTimeMs,
      refetchInterval: featureBannersStaleTimeMs,
      refetchIntervalInBackground: false,
      retryOnMount: false,
    }),
};
