import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { contestsQuery } from "@/entities/contest";
import { ContestsPage } from "@/pages/contests";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { getQueryClient } from "@/shared/lib/query-client";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
export const metadata: Metadata = { title: "Конкурсы — Artmate Admin" };
export default async function Page() {
  const { user } = await getAdminSession();
  if (!user)
    redirect(`${routes.login}?next=${encodeURIComponent(routes.contests)}`);
  const client = getQueryClient();
  await client.prefetchQuery(contestsQuery.list());
  return (
    <HydrationBoundary state={dehydrateQueryClient(client)}>
      <ContestsPage currentUser={user} />
    </HydrationBoundary>
  );
}
