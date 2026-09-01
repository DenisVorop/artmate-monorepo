import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WorkshopDataBuilder } from "@/app/lib/workshop-data-builder";
import { WorkEditorPage } from "@/pages/work-editor";
import { getAuthSession } from "@/shared/actions/auth";
import { parseColoringNumber, routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Редактор фотографии работы - Artmate",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ collectionSlug: string; number: string }> };

export default async function Page({ params }: Props) {
  const { collectionSlug, number: numberSegment } = await params;
  const number = parseColoringNumber(numberSegment);

  if (number === null) {
    notFound();
  }

  const path = routes.workshopColoring(collectionSlug, number);
  const session = ApiResult.fromDTO(await getAuthSession()).data;

  if (!session?.user) {
    redirect(`${routes.auth}?next=${encodeURIComponent(path)}`);
  }

  const { coloring, queryClient } = await new WorkshopDataBuilder()
    .withColoring(collectionSlug, number)
    .withTools()
    .withMarkerColors()
    .build();

  if (
    !coloring ||
    coloring.collection.slug !== collectionSlug ||
    coloring.coloring.number !== number
  ) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <WorkEditorPage slug={collectionSlug} number={number} />
    </HydrationBoundary>
  );
}
