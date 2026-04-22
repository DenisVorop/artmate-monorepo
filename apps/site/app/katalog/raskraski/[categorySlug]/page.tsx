import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogPage } from "@/pages/catalog";
import { CATEGORIES, getProductCategoryBySlug } from "@/entities/products";
import { routes, siteConfig } from "@/shared";

type CatalogCategoryRouteProps = {
  params: Promise<{
    categorySlug: string;
  }>;
};

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({
    categorySlug: category.slug,
  }));
}

export async function generateMetadata({ params }: CatalogCategoryRouteProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = getProductCategoryBySlug(categorySlug);

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
  const category = getProductCategoryBySlug(categorySlug);

  if (!category) {
    notFound();
  }

  return <CatalogPage initialCategoryId={category.id} />;
}
