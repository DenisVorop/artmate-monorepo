import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { workshopModerationQuery } from "@/entities/workshop-moderation";
import { WorkshopModerationDetailPage } from "@/pages/workshop-moderation-detail";
import { getAdminSession } from "@/shared/actions/auth";
import {
  isWorkshopModerationNotFoundError,
  workshopModerationRevisionIdSchema,
} from "@/shared/actions/workshop-moderation";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Проверка работы - Artmate Admin",
};

type Props = {
  readonly params: Promise<{ revisionId: string }>;
};

export default async function Page({ params }: Props) {
  const { revisionId } = await params;

  if (!workshopModerationRevisionIdSchema.safeParse(revisionId).success) {
    notFound();
  }

  const session = await getAdminSession();
  const route = routes.workshopModerationRevision(revisionId);

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(route)}`);
  }

  const queryClient = getQueryClient();

  try {
    await queryClient.fetchQuery(workshopModerationQuery.detail(revisionId));
  } catch (error) {
    if (isWorkshopModerationNotFoundError(error)) {
      notFound();
    }

    throw error;
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <WorkshopModerationDetailPage
        currentUser={session.user}
        revisionId={revisionId}
      />
    </HydrationBoundary>
  );
}
