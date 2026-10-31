import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { getProductCategoryBySlug } from "@/entities/products";
import { CatalogPage } from "@/pages/catalog";
import { getProductsData } from "@/shared/actions/products";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { CatalogCategoryStructuredData, createCategoryMetadata, Seo } from "@/shared/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const productsData = (await getProductsData()).data;
  const category = getProductCategoryBySlug(productsData?.categories ?? [], "markery");
  if (!category) return {};

  return Seo.getMetadata({
    path: routes.catalogMarkers,
    fallback: createCategoryMetadata(category),
  });
}

export default async function Page() {
  const { queryClient, productsData, category } = await new CatalogDataBuilder()
    .withProducts()
    .withReviews()
    .withCategory("markery")
    .build();
  if (!productsData || !category) notFound();

  return (
    <>
      <CatalogCategoryStructuredData
        category={category}
        products={productsData.products.filter((product) => product.categoryId === category.id)}
        url={routes.catalogMarkers}
      />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <CatalogPage category={category} initialCategoryId={category.id} section="markers" />
      </HydrationBoundary>
    </>
  );
}
