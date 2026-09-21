import { achievementDraftsQuery } from "@/entities/achievement-drafts";
import { getQueryClient } from "@/shared/lib/query-client";

export async function buildAchievementDraftsData() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(achievementDraftsQuery.list());

  return queryClient;
}
