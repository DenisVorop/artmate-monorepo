import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { contestDrawQuery } from "@/entities/contest-draw";
import { ContestsPage } from "@/pages/contests";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { getQueryClient } from "@/shared/lib/query-client";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = {
  title: "Победители конкурса — Artmate Admin",
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
      `${routes.login}?next=${encodeURIComponent(routes.contestResults(contestId))}`,
    );
  const client = getQueryClient();
  try {
    await client.fetchQuery(contestDrawQuery.detail(contestId));
  } catch (error) {
    if (error instanceof Error && error.message === "Конкурс не найден")
      notFound();
    throw error;
  }
  return (
    <HydrationBoundary state={dehydrateQueryClient(client)}>
      <ContestsPage currentUser={user} mode="results" contestId={contestId} />
    </HydrationBoundary>
  );
}
