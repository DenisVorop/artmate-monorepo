import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { catalogLandingsQuery } from "@/entities/catalog-landings";
import { CatalogLandingsPage } from "@/pages/catalog-landings";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Подборки каталога - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.catalogLandings)}`);
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(catalogLandingsQuery.list());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogLandingsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
