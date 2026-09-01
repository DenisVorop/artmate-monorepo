import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { PublicWorkshopPage } from "@/pages/public-workshop";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Мастерская участника - Artmate",
  description: "Опубликованные работы участника клуба Artmate.",
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ handle: string }> };

export default async function Page({ params }: Props) {
  const { handle } = await params;
  const { workshop, queryClient } = await new CommunityDataBuilder().withWorkshop(handle).build();

  if (!workshop || workshop.handle !== handle) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PublicWorkshopPage handle={handle} />
    </HydrationBoundary>
  );
}
