import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { coloringCollectionsQuery } from "@/entities/coloring-collections";
import { DigitalVersionsPage } from "@/pages/digital-versions";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = { title: "Цифровые версии - Artmate Admin" };

export default async function Page() {
  const session = await getAdminSession();
  if (!session.user) redirect(`${routes.login}?next=${encodeURIComponent(routes.digitalVersions)}`);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(coloringCollectionsQuery.list());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <DigitalVersionsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
