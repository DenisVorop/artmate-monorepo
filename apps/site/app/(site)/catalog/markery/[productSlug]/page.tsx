import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { getProductBySlug, getProductCategoryBySlug } from "@/entities/products";
import { ProductPage } from "@/pages/product";
import { getProductsData } from "@/shared/actions/products";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createProductMetadata, ProductStructuredData, Seo } from "@/shared/lib/seo";

type Props = { params: Promise<{ productSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { productSlug } = await params;
  const productsData = (await getProductsData()).data;
  const category = getProductCategoryBySlug(productsData?.categories ?? [], "markery");
  const product = getProductBySlug(productsData?.products ?? [], productSlug);
  if (!category || !product || product.categoryId !== category.id) return {};

  return Seo.getMetadata({
    path: routes.product(category.slug, product.slug),
    fallback: createProductMetadata(product, category),
  });
}

export default async function Page({ params }: Props) {
  const { productSlug } = await params;
  const { queryClient, category, product } = await new CatalogDataBuilder()
    .withProducts()
    .withReviews()
    .withCategory("markery")
    .withProduct(productSlug)
    .build();
  if (!category || !product || product.categoryId !== category.id) notFound();

  return (
    <>
      <ProductStructuredData
        category={category}
        product={product}
        url={routes.product(category.slug, product.slug)}
      />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ProductPage productId={product.id} />
      </HydrationBoundary>
    </>
  );
}
