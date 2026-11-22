import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { contestEntriesQuery } from "@/entities/contest-entry";
import { ContestModerationPage } from "@/pages/contest-moderation";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { getQueryClient } from "@/shared/lib/query-client";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = { title: "Проверка работы — Artmate Admin" };
export default async function Page({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const { user } = await getAdminSession();
  if (!user)
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.contestEntry(entryId))}`,
    );
  const client = getQueryClient();
  try {
    await client.fetchQuery(contestEntriesQuery.detail(entryId));
  } catch (error) {
    if (error instanceof Error && error.message === "Заявка не найдена")
      notFound();
    throw error;
  }
  return (
    <HydrationBoundary state={dehydrateQueryClient(client)}>
      <ContestModerationPage currentUser={user} entryId={entryId} />
    </HydrationBoundary>
  );
}
