import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { contestsQuery } from "@/entities/contest";
import { contestEntriesQuery } from "@/entities/contest-entry";
import { ContestModerationPage } from "@/pages/contest-moderation";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { getQueryClient } from "@/shared/lib/query-client";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = {
  title: "Заявки на конкурс — Artmate Admin",
};
export default async function Page({
  params,
}: {
  params: Promise<{ contestId: string }>;
}) {
  const { contestId } = await params;
  const { user } = await getAdminSession();
  if (!user)
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.contestEntries(contestId))}`,
    );
  const client = getQueryClient();
  try {
    await client.fetchQuery(contestsQuery.detail(contestId));
  } catch (error) {
    if (error instanceof Error && error.message === "Конкурс не найден")
      notFound();
    throw error;
  }
  await client.prefetchInfiniteQuery(
    contestEntriesQuery.list(contestId, "PENDING"),
  );
  return (
    <HydrationBoundary state={dehydrateQueryClient(client)}>
      <ContestModerationPage currentUser={user} contestId={contestId} />
    </HydrationBoundary>
  );
}
