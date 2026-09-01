import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WorkshopDataBuilder } from "@/app/lib/workshop-data-builder";
import { WorkshopCollectionPage } from "@/pages/workshop-collection";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Тематика мастерской - Artmate",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ collectionSlug: string }> };

export default async function Page({ params }: Props) {
  const { collectionSlug } = await params;
  const path = routes.workshopCollection(collectionSlug);
  const session = ApiResult.fromDTO(await getAuthSession()).data;

  if (!session?.user) {
    redirect(`${routes.auth}?next=${encodeURIComponent(path)}`);
  }

  const { collection, queryClient } = await new WorkshopDataBuilder()
    .withCollection(collectionSlug)
    .build();

  if (!collection || collection.slug !== collectionSlug) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <WorkshopCollectionPage slug={collectionSlug} />
    </HydrationBoundary>
  );
}
