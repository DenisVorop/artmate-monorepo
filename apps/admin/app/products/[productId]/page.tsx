import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";

import { productsQuery } from "@/entities/products";
import { ProductPage } from "@/pages/product";
import { getAdminSession } from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { getQueryClient } from "@/shared/lib/query-client";

export const metadata: Metadata = {
  title: "Товар - Artmate Admin",
};

type ProductRouteProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function Page({ params }: ProductRouteProps) {
  const { productId } = await params;
  const session = await getAdminSession();

  if (!session.user) {
    redirect(
      `${routes.login}?next=${encodeURIComponent(routes.product(productId))}`,
    );
  }

  const queryClient = getQueryClient();

  await fetchAdminProductOrNotFound(queryClient, productId);
  await Promise.all([
    queryClient.prefetchQuery(productsQuery.categories()),
    queryClient.prefetchQuery(productsQuery.tags()),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <ProductPage currentUser={session.user} productId={productId} />
    </HydrationBoundary>
  );
}

async function fetchAdminProductOrNotFound(
  queryClient: ReturnType<typeof getQueryClient>,
  productId: string,
) {
  try {
    await queryClient.fetchQuery(productsQuery.detail(productId));
  } catch (error) {
    if (isProductNotFoundError(error)) {
      notFound();
    }

    throw error;
  }
}

function isProductNotFoundError(error: unknown) {
  return error instanceof Error && error.message === "Product not found";
}
