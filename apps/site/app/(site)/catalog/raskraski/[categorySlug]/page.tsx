import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage } from "@/pages/catalog";
import { ProductPage } from "@/pages/product";
import { getProductBySlug, getProductCategoryBySlug } from "@/entities/products";
import { getProductsData } from "@/shared/actions/products";
import { routes } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import {
  CatalogCategoryStructuredData,
  createCategoryMetadata,
  createProductMetadata,
  ProductStructuredData,
  Seo,
} from "@/shared/lib/seo";
import { HydrationBoundary } from "@tanstack/react-query";

type CatalogCategoryRouteProps = {
  params: Promise<{
    categorySlug: string;
  }>;
};

export async function generateMetadata({ params }: CatalogCategoryRouteProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const productsData = (await getProductsData()).data;
  const category = getProductCategoryBySlug(productsData?.categories ?? [], categorySlug);

  if (category) {
    return Seo.getMetadata({
      path: routes.catalogCategory(category.slug),
      fallback: createCategoryMetadata(category),
    });
  }

  const product = getProductBySlug(productsData?.products ?? [], categorySlug);

  if (!product || product.categoryId) {
    return {};
  }

  return Seo.getMetadata({
    path: routes.product(undefined, product.slug),
    fallback: createProductMetadata(product),
  });
}

export default async function Page({ params }: CatalogCategoryRouteProps) {
  const { categorySlug } = await params;
  const { queryClient, productsData, category, product } = await new CatalogDataBuilder()
    .withProducts()
    .withCatalogLandings()
    .withReviews()
    .withCategory(categorySlug)
    .withProduct(categorySlug)
    .build();

  if (!productsData || productsData.products.length === 0) {
    notFound();
  }

  if (category) {
    const categoryUrl = routes.catalogCategory(category.slug);
    const categoryProducts = productsData.products.filter(
      (productItem) => productItem.categoryId === category.id,
    );

    return (
      <>
        <CatalogCategoryStructuredData
          category={category}
          products={categoryProducts}
          url={categoryUrl}
        />
        <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
          <CatalogPage category={category} initialCategoryId={category.id} />
        </HydrationBoundary>
      </>
    );
  }

  if (!product || product.categoryId) {
    notFound();
  }

  const productUrl = routes.product(undefined, product.slug);

  return (
    <>
      <ProductStructuredData product={product} url={productUrl} />
      <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
        <ProductPage productId={product.id} />
      </HydrationBoundary>
    </>
  );
}
