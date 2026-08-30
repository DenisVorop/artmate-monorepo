import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ColoringDataBuilder } from "@/app/lib/coloring-data-builder";
import { ColoringPage } from "@/pages/coloring";
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
    .build();

  if (coloring === null) {
    notFound();
  }

  return (
    <>
      <ColoringStructuredData coloring={coloring} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ColoringPage
          collectionSlug={collectionSlug}
          number={number}
          publishedRevisionId={coloring.publishedRevisionId}
        />
      </HydrationBoundary>
    </>
  );
}
