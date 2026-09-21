import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { buildAchievementDraftsData } from "@/app/lib/achievement-drafts-data-builder";
import { AchievementDraftsPage } from "@/pages/achievement-drafts";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Ачивки - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.achievementDrafts)}`,
    );
  }

  const queryClient = await buildAchievementDraftsData();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <AchievementDraftsPage />
    </HydrationBoundary>
  );
}
