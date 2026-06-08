import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { CatalogLandingCreatePage } from "@/pages/catalog-landing-create";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Новая подборка каталога - Artmate Admin",
};

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.catalogLandingCreate)}`);
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(productsQuery.list()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogLandingCreatePage currentUser={session.user} />
    </HydrationBoundary>
  );
}
