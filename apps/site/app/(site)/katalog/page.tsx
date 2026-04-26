import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage } from "@/pages/catalog";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { HydrationBoundary } from "@tanstack/react-query";

export { metadata } from "@/pages/catalog/metadata";

export default async function Page() {
  const { queryClient } = await new CatalogDataBuilder().withProducts().build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogPage />
    </HydrationBoundary>
  );
}
