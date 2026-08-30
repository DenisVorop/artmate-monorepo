import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ColoringCollectionsDataBuilder } from "@/app/lib/coloring-collections-data-builder";
import { ColoringCollectionPage } from "@/pages/coloring-collection";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import {
  ColoringCollectionStructuredData,
  createColoringCollectionMetadata,
} from "@/shared/lib/seo";

type ColoringCollectionRouteProps = {
  params: Promise<{
    collectionSlug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ColoringCollectionRouteProps): Promise<Metadata> {
  const { collectionSlug } = await params;
  const { collection } = await new ColoringCollectionsDataBuilder()
    .withCollection(collectionSlug)
    .build();

  if (collection === null) {
    return {};
  }

  return createColoringCollectionMetadata(collection);
}

export default async function Page({ params }: ColoringCollectionRouteProps) {
  const { collectionSlug } = await params;
  const { collection, queryClient } = await new ColoringCollectionsDataBuilder()
    .withCollection(collectionSlug)
    .build();

  if (collection === null) {
    notFound();
  }

  return (
    <>
      <ColoringCollectionStructuredData collection={collection} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ColoringCollectionPage slug={collectionSlug} />
      </HydrationBoundary>
    </>
  );
}
