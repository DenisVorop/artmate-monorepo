import { HydrationBoundary } from "@tanstack/react-query";

import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { GalleryPage } from "@/pages/gallery";
import { readGalleryFilters } from "@/features/community-gallery";
import type { SearchParams } from "@/shared/lib/query-state-manager";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createPageMetadata, GalleryStructuredData, Seo } from "@/shared/lib/seo";

export function generateMetadata() {
  return Seo.getMetadata({ path: routes.gallery, fallback: createPageMetadata("gallery") });
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = readGalleryFilters(await searchParams);
  const { queryClient, gallery } = await new CommunityDataBuilder()
    .withGalleryFilters()
    .withGalleryProducts()
    .withGallery(filters)
    .build();

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <GalleryStructuredData
        url={routes.gallery}
        works={gallery?.pages.flatMap((page) => page.works) ?? []}
      />
      <GalleryPage />
    </HydrationBoundary>
  );
}
