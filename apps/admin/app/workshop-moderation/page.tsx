import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { workshopModerationQuery } from "@/entities/workshop-moderation";
import { WorkshopModerationPage } from "@/pages/workshop-moderation";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Модерация работ - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.workshopModeration)}`,
    );
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(workshopModerationQuery.queue("PENDING"));

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <WorkshopModerationPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
