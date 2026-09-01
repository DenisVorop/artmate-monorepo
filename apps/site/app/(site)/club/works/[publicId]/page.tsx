import { HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { PublicWorkPage } from "@/pages/public-work";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";

export const metadata: Metadata = {
  title: "Работа участника - Artmate",
  description: "Готовая раскраска участника клуба Artmate.",
  robots: { index: false, follow: true },
};

type Props = { params: Promise<{ publicId: string }> };

export default async function Page({ params }: Props) {
  const { publicId } = await params;
  const { work, queryClient } = await new CommunityDataBuilder().withWork(publicId).build();

  if (!work || work.publicId !== publicId) {
    notFound();
  }

  await new CommunityDataBuilder(undefined, undefined, queryClient)
    .withRelatedWorks(work.official.collection.slug, work.official.coloring.number)
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <PublicWorkPage publicId={publicId} />
    </HydrationBoundary>
  );
}
