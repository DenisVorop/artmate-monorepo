import { HydrationBoundary } from "@tanstack/react-query";
import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage } from "@/pages/catalog";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.catalogColorings,
    fallback: createPageMetadata("catalogColorings"),
  });
}

export default async function Page() {
  const { queryClient } = await new CatalogDataBuilder()
    .withProducts()
    .withCatalogLandings()
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogPage section="colorings" />
    </HydrationBoundary>
  );
}
