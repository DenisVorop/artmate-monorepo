import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { catalogLandingsQuery } from "@/entities/catalog-landings";
import { productsQuery } from "@/entities/products";
import { CatalogLandingDetailPage } from "@/pages/catalog-landing-detail";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Подборка каталога - Artmate Admin",
};

type CatalogLandingRouteProps = {
  params: Promise<{
    landingId: string;
  }>;
};

export default async function Page({ params }: CatalogLandingRouteProps) {
  const { landingId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.catalogLanding(landingId))}`,
    );
  }

  const queryClient = getQueryClient();

  await fetchCatalogLandingOrNotFound(queryClient, landingId);
  await Promise.all([
    queryClient.prefetchQuery(productsQuery.list()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogLandingDetailPage currentUser={session.user} landingId={landingId} />
    </HydrationBoundary>
  );
}

async function fetchCatalogLandingOrNotFound(
  queryClient: ReturnType<typeof getQueryClient>,
  landingId: string,
) {
  try {
    await queryClient.fetchQuery(catalogLandingsQuery.detail(landingId));
  } catch (error) {
    if (isCatalogLandingNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

function isCatalogLandingNotFoundError(error: unknown) {
  return (
    error instanceof Error &&
    error.message === "Catalog landing page not found"
  );
}
