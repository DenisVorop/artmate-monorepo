import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogDataBuilder } from "@/app/lib/catalog-data-builder";
import { CatalogPage } from "@/pages/catalog";
import { getProductCategoryBySlug } from "@/entities/products";
import { getProductsData } from "@/shared/actions/products";
import { routes, siteConfig } from "@/shared/constants";
import { dehydrateQueryClient } from "@/shared/lib/dehydrate-query-client";
import { HydrationBoundary } from "@tanstack/react-query";

type CatalogCategoryRouteProps = {
  params: Promise<{
    categorySlug: string;
  }>;
};

export async function generateStaticParams() {
  const productsData = (await getProductsData()).data;

  return (productsData?.categories ?? []).map((category) => ({
    categorySlug: category.slug,
  }));
}

export async function generateMetadata({ params }: CatalogCategoryRouteProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const productsData = (await getProductsData()).data;
  const category = getProductCategoryBySlug(productsData?.categories ?? [], categorySlug);

  if (!category) {
    return {};
  }

  const title = `${category.title} - раскраски по\u00a0номерам Artmate`;
  const description = `Раскраски Artmate в\u00a0категории «${category.title}»: альбомы A4 на\u00a0плотной бумаге для\u00a0спокойного творческого вечера.`;
  const url = routes.catalogCategory(category.slug);

  return {
    title: {
      absolute: title,
    },
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: category.image,
          width: 1200,
          height: 1200,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [category.image],
    },
  };
}

export default async function Page({ params }: CatalogCategoryRouteProps) {
  const { categorySlug } = await params;
  const { queryClient, productsData, category } = await new CatalogDataBuilder()
    .withProducts()
    .withCategory(categorySlug)
    .build();

  if (!category || !productsData || productsData.products.length === 0) {
    notFound();
  }

  return (
    <HydrationBoundary state={dehydrateQueryClient(queryClient)}>
      <CatalogPage initialCategoryId={category.id} />
    </HydrationBoundary>
  );
}
