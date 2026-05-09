import { queryOptions } from "@tanstack/react-query";

import { getAdminFeatureBanners } from "@/shared/actions/feature-banners";

const featureBannersStaleTimeMs = 1000 * 30;

export const featureBannersQueryKeys = {
  all: ["admin-feature-banners"] as const,
  list: () => [...featureBannersQueryKeys.all, "list"] as const,
};

export const featureBannersQuery = {
  list: () =>
    queryOptions({
      queryKey: featureBannersQueryKeys.list(),
      queryFn: getAdminFeatureBanners,
      staleTime: featureBannersStaleTimeMs,
      retryOnMount: false,
    }),
};
