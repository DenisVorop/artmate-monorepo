import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { ProductCategoriesPage } from "@/pages/product-categories";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/product-categories/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.productCategories)}`,
    );
  }

  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(productsQuery.categories()),
    queryClient.prefetchQuery(productsQuery.list()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ProductCategoriesPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
