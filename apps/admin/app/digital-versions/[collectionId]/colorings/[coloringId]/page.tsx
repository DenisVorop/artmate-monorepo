import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "@/entities/coloring-collections";
import { coloringsQuery } from "@/entities/colorings";
import { markerColorsQuery } from "@/entities/marker-colors";
import { productsQuery } from "@/entities/products";
import { ColoringDetailPage } from "@/pages/coloring-detail";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Раскраска - Artmate Admin" };

type Props = { params: Promise<{ collectionId: string; coloringId: string }> };

export default async function Page({ params }: Props) {
  const { collectionId, coloringId } = await params;
  const session = await getAdminSession();
  const route = routes.digitalVersionColoring(collectionId, coloringId);
  if (!session.user)
    redirect(`${routes.login}?next=${encodeURIComponent(route)}`);

  const queryClient = getQueryClient();
  try {
    const coloring = await queryClient.fetchQuery(
      coloringsQuery.detail(coloringId),
    );
    if (coloring.collectionId !== collectionId) notFound();
  } catch (error) {
    if (error instanceof Error && error.message === "Coloring not found")
      notFound();
    throw error;
  }
  await Promise.all([
    queryClient.prefetchQuery(coloringsQuery.list()),
    queryClient.prefetchQuery(markerColorsQuery.catalog()),
    queryClient.prefetchQuery(coloringsQuery.revisions(coloringId)),
    queryClient.prefetchQuery(coloringCollectionsQuery.list()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ColoringDetailPage
        collectionId={collectionId}
        coloringId={coloringId}
        currentUser={session.user}
      />
    </HydrationBoundary>
  );
}
