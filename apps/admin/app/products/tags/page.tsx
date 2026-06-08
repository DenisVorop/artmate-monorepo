import { redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { ProductTagsPage } from "@/pages/product-tags";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export { metadata } from "@/pages/product-tags/metadata";

export default async function Page() {
  const session = await getAdminSession();

  if (!session.user) {
    redirect(`${routes.login}?next=${encodeURIComponent(routes.productTags)}`);
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(productsQuery.tags());

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ProductTagsPage currentUser={session.user} />
    </HydrationBoundary>
  );
}
