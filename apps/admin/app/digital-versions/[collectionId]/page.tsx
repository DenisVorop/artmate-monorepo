import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "@/entities/coloring-collections";
import { coloringsQuery } from "@/entities/colorings";
import { productsQuery } from "@/entities/products";
import { DigitalVersionDetailPage } from "@/pages/digital-version-detail";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Цифровая версия - Artmate Admin" };

export default async function Page({ params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const session = await getAdminSession();
  if (!session.user) redirect(`${routes.login}?next=${encodeURIComponent(routes.digitalVersion(collectionId))}`);

  const queryClient = getQueryClient();
  try {
    await queryClient.fetchQuery(coloringCollectionsQuery.detail(collectionId));
  } catch (error) {
    if (error instanceof Error && error.message === "Coloring collection not found") notFound();
    throw error;
  }
  await Promise.all([
    queryClient.prefetchQuery(coloringsQuery.list()),
    queryClient.prefetchQuery(productsQuery.list()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <DigitalVersionDetailPage collectionId={collectionId} currentUser={session.user} />
    </HydrationBoundary>
  );
}
