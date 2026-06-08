import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { CatalogLandingDataBuilder } from "@/app/lib/catalog-landing-data-builder";
import { CatalogLandingPage } from "@/pages/catalog-landing";
import { getCatalogLandingPage } from "@/shared/actions/catalog-landings";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import {
  CatalogLandingStructuredData,
  createCatalogLandingMetadata,
  Seo,
} from "@/shared/lib/seo";

type CatalogLandingRouteProps = {
  params: Promise<{
    collectionSlug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CatalogLandingRouteProps): Promise<Metadata> {
  const { collectionSlug } = await params;
  const landing = (await getCatalogLandingPage(collectionSlug)).data;

  if (!landing) {
    return {};
  }

  return Seo.getMetadata({
    path: routes.catalogLanding(landing.slug),
    fallback: createCatalogLandingMetadata({
      image: landing.products[0]?.image,
      isIndexable: landing.isIndexable,
      metaDescription: landing.metaDescription,
      metaTitle: landing.metaTitle,
      slug: landing.slug,
    }),
  });
}

export default async function Page({ params }: CatalogLandingRouteProps) {
  const { collectionSlug } = await params;
  const { queryClient, landing } = await new CatalogLandingDataBuilder()
    .withLanding(collectionSlug)
    .withCatalogLandings()
    .build();

  if (!landing || landing.products.length < landing.minProducts) {
    notFound();
  }

  const landingUrl = routes.catalogLanding(landing.slug);

  return (
    <>
      <CatalogLandingStructuredData
        description={landing.metaDescription}
        products={landing.products}
        title={landing.h1}
        url={landingUrl}
      />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <CatalogLandingPage landing={landing} />
      </HydrationBoundary>
    </>
  );
}
