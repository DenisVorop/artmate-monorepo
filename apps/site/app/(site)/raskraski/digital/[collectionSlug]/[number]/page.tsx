import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ColoringDataBuilder } from "@/app/lib/coloring-data-builder";
import { ColoringVariantsDataBuilder } from "@/app/lib/coloring-variants-data-builder";
import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { ColoringPage } from "@/pages/coloring";
import { ColoringVariantsPage } from "@/pages/coloring-variants";
import { parseColoringNumber } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { ColoringStructuredData, createColoringMetadata } from "@/shared/lib/seo";

type ColoringRouteProps = {
  params: Promise<{
    collectionSlug: string;
    number: string;
  }>;
};

export async function generateMetadata({ params }: ColoringRouteProps): Promise<Metadata> {
  const { collectionSlug, number: numberSegment } = await params;
  const number = parseColoringNumber(numberSegment);

  if (number === null) {
    return {};
  }

  const { coloring } = await new ColoringDataBuilder().withColoring(collectionSlug, number).build();

  if (coloring === null) {
    return {};
  }

  return createColoringMetadata(coloring);
}

export default async function Page({ params }: ColoringRouteProps) {
  const { collectionSlug, number: numberSegment } = await params;
  const number = parseColoringNumber(numberSegment);

  if (number === null) {
    notFound();
  }

  const { coloring, queryClient } = await new ColoringDataBuilder()
    .withColoring(collectionSlug, number)
    .withProducts()
    .build();

  if (coloring === null) {
    notFound();
  }

  const variants =
    coloring.viewerMode === "materials"
      ? (
          await new ColoringVariantsDataBuilder(undefined, undefined, queryClient)
            .withColoringVariants(collectionSlug, number)
            .build()
        ).coloring
      : null;

  if (coloring.viewerMode === "materials" && variants === null) {
    throw new Error(`Coloring materials viewer is unavailable for "${collectionSlug}/${number}"`);
  }

  await new CommunityDataBuilder(undefined, undefined, queryClient)
    .withRelatedWorks(collectionSlug, number)
    .build();

  return (
    <>
      <ColoringStructuredData coloring={coloring} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        {variants ? (
          <ColoringVariantsPage
            collectionSlug={collectionSlug}
            number={number}
            token={variants.token}
          />
        ) : (
          <ColoringPage
            collectionSlug={collectionSlug}
            number={number}
            publishedRevisionId={coloring.publishedRevisionId}
          />
        )}
      </HydrationBoundary>
    </>
  );
}
