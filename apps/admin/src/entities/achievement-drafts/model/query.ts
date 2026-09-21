import { queryOptions } from "@tanstack/react-query";

import { getAchievementDrafts } from "@/shared/actions/achievement-drafts";

export const achievementDraftsQueryKeys = {
  all: ["admin-achievement-drafts"] as const,
  list: () => [...achievementDraftsQueryKeys.all, "list"] as const,
};

export const achievementDraftsQuery = {
  list: () =>
    queryOptions({
      queryKey: achievementDraftsQueryKeys.list(),
      queryFn: getAchievementDrafts,
      staleTime: Infinity,
      retryOnMount: false,
    }),
};
