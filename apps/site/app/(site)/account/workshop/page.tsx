import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { WorkshopDataBuilder } from "@/app/lib/workshop-data-builder";
import { WorkshopOverviewPage } from "@/pages/workshop-overview";
import { getAuthSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Моя мастерская - Artmate",
  description: "Личная мастерская готовых раскрасок Artmate.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const session = ApiResult.fromDTO(await getAuthSession()).data;

  if (!session?.user) {
    redirect(`${routes.auth}?next=${encodeURIComponent(routes.workshop)}`);
  }

  const { workshop, queryClient } = await new WorkshopDataBuilder()
    .withWorkshop()
    .withAvailableCollections()
    .build();

  if (!workshop) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <WorkshopOverviewPage />
    </HydrationBoundary>
  );
}
