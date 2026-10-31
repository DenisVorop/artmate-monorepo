import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { CommunityDataBuilder } from "@/app/lib/community-data-builder";
import { communityWorkQuery, getCommunityCollectionTitle } from "@/entities/community-work";
import { readGalleryFilters } from "@/features/community-gallery";
import { GalleryPage } from "@/pages/gallery";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createGalleryCollectionMetadata, GalleryStructuredData } from "@/shared/lib/seo";
import { routes } from "@/shared/constants";
import type { SearchParams } from "@/shared/lib/query-state-manager";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { galleryCollection } = await new CommunityDataBuilder()
    .withGalleryFilters()
    .withGalleryCollection(slug)
    .build();
  if (!galleryCollection) notFound();
  return createGalleryCollectionMetadata(
    slug,
    getCommunityCollectionTitle(galleryCollection.title),
  );
}

export default async function Page({ params, searchParams }: Props) {
  const [{ slug }, filters] = await Promise.all([params, searchParams]);
  const { queryClient, galleryCollection } = await new CommunityDataBuilder()
    .withGalleryFilters()
    .withGalleryProducts()
    .withGalleryCollection(slug, filters)
    .build();
  if (!galleryCollection) notFound();
  const title = getCommunityCollectionTitle(galleryCollection.title);
  const gallery = queryClient.getQueryData(
    communityWorkQuery.gallery(readGalleryFilters(filters, galleryCollection.slug)).queryKey,
  );
  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <GalleryStructuredData
        url={routes.galleryCollection(slug)}
        collection={{ slug: galleryCollection.slug, title }}
        works={gallery?.pages.flatMap((page) => page.works) ?? []}
      />
      <GalleryPage initialCollectionSlug={galleryCollection.slug} collectionTitle={title} />
    </HydrationBoundary>
  );
}
