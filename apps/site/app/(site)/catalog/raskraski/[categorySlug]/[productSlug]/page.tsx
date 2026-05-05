import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { ProductPage } from "@/pages/product";
import {
  getProductBySlug,
  getProductCategoryBySlug,
} from "@/entities/products";
import { getProductsData } from "@/shared/actions/products";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { createProductMetadata, ProductStructuredData, Seo } from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";

type ProductRouteProps = {
  params: Promise<{
    categorySlug: string;
    productSlug: string;
  }>;
};

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { categorySlug, productSlug } = await params;
  const productsData = (await getProductsData()).data;
  const category = getProductCategoryBySlug(productsData?.categories ?? [], categorySlug);
  const product = getProductBySlug(productsData?.products ?? [], productSlug);

  if (!category || !product || product.categoryId !== category.id) {
    return {};
  }

  return Seo.getMetadata({
    path: routes.product(category.slug, product.slug),
    fallback: createProductMetadata(product, category),
  });
}

export default async function Page({ params }: ProductRouteProps) {
  const { categorySlug, productSlug } = await params;
  const { queryClient, productsData, category, product } = await new CatalogDataBuilder()
    .withProducts()
    .withReviews()
    .withCategory(categorySlug)
    .withProduct(productSlug)
    .build();

  if (
    !category ||
    !product ||
    !productsData ||
    productsData.products.length === 0 ||
    product.categoryId !== category.id
  ) {
    notFound();
  }

  const productUrl = routes.product(category.slug, product.slug);

  return (
    <>
      <ProductStructuredData category={category} product={product} url={productUrl} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ProductPage productId={product.id} />
      </HydrationBoundary>
    </>
  );
}
