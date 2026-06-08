import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { ProductsPage } from "@/pages/products";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/products/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.products)}`);
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(productsQuery.list()),
    queryClient.prefetchQuery(productsQuery.categories()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ProductsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
