import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage } from "@/pages/catalog";
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

export default async function Page() {
  const { queryClient } = await new CatalogDataBuilder().withProducts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogPage />
    </HydrationBoundary>
  );
}
