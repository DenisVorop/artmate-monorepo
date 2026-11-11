import { Suspense } from "react";
import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage, CatalogPageBody, CatalogPageLoading } from "@/pages/catalog";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, Seo } from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.catalog,
    fallback: createPageMetadata("catalog"),
  });
}

export default function Page() {
  return (
    <CatalogPage>
      <Suspense fallback={<CatalogPageLoading />}>
        <CatalogData />
      </Suspense>
    </CatalogPage>
  );
}

async function CatalogData() {
  const { queryClient } = await new CatalogDataBuilder()
    .withProducts()
    .withCatalogLandings()
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogPageBody />
    </HydrationBoundary>
  );
}
