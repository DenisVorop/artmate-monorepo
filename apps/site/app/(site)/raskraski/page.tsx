import { HydrationBoundary } from "@tanstack/react-query";

import { ColoringCollectionsDataBuilder } from "@/app/lib/coloring-collections-data-builder";
import { ColoringCollectionsPage } from "@/pages/coloring-collections";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import {
  ColoringCollectionsStructuredData,
  createColoringCollectionsMetadata,
  Seo,
} from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({
    path: routes.colorings,
    fallback: createColoringCollectionsMetadata(),
  });
}

export default async function Page() {
  const { collections, queryClient } = await new ColoringCollectionsDataBuilder()
    .withCollections()
    .build();

  return (
    <>
      <ColoringCollectionsStructuredData collections={collections} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ColoringCollectionsPage />
      </HydrationBoundary>
    </>
  );
}
