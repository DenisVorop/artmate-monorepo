import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { seoQuery } from "@/entities/seo";
import { SeoPage } from "@/pages/seo";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/seo/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.seo)}`);
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(seoQuery.list()),
    queryClient.prefetchQuery(productsQuery.list()),
    queryClient.prefetchQuery(productsQuery.categories()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <SeoPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
