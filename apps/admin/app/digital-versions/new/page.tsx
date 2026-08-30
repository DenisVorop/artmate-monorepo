import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "@/entities/coloring-collections";
import { productsQuery } from "@/entities/products";
import { DigitalVersionCreatePage } from "@/pages/digital-version-create";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Новая цифровая версия - Artmate Admin" };

export default async function Page() {
  const session = await getAdminSession();
  if (!session.user) redirect(`${routes.login}?next=${encodeURIComponent(routes.digitalVersionCreate)}`);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(coloringCollectionsQuery.list()),
    queryClient.prefetchQuery(productsQuery.list()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <DigitalVersionCreatePage currentUser={session.user} />
    </HydrationBoundary>
  );
}
