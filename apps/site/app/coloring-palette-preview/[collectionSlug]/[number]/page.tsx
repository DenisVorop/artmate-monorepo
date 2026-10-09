import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ColoringVariantsDataBuilder } from "@/app/lib/coloring-variants-data-builder";
import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { ColoringVariantsPage } from "@/pages/coloring-variants";
import { parseColoringNumber } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Выбор палитры — Artmate",
  robots: { index: false, follow: false },
};

export default async function Page({
  params,
}: {
  params: Promise<{ collectionSlug: string; number: string }>;
}) {
  const { collectionSlug, number: numberSegment } = await params;
  const number = parseColoringNumber(numberSegment);
  if (number === null) notFound();

  const { coloring, queryClient } = await new ColoringVariantsDataBuilder()
    .withColoringVariants(collectionSlug, number)
    .withProducts()
    .build();
  if (coloring === null) notFound();

  await new CommunityDataBuilder(undefined, undefined, queryClient)
    .withRelatedWorks(collectionSlug, number)
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ColoringVariantsPage
        collectionSlug={collectionSlug}
        number={number}
        token={coloring.token}
      />
    </HydrationBoundary>
  );
}
