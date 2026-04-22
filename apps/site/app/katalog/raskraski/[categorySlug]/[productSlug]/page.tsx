import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductPage } from "@/pages/product";
import {
  PRODUCTS,
  getProductBySlug,
  getProductCategory,
  getProductCategoryBySlug,
  getRelatedProducts,
} from "@/entities/products";
import { routes, siteConfig } from "@/shared";

type ProductRouteProps = {
  params: Promise<{
    categorySlug: string;
    productSlug: string;
  }>;
};

export function generateStaticParams() {
  return PRODUCTS.flatMap((product) => {
    const category = getProductCategory(product.categoryId);

    if (!category) {
      return [];
    }

    return [
      {
        categorySlug: category.slug,
        productSlug: product.slug,
      },
    ];
  });
}

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  const { categorySlug, productSlug } = await params;
  const category = getProductCategoryBySlug(categorySlug);
  const product = getProductBySlug(productSlug);

  if (!category || !product || product.categoryId !== category.id) {
    return {};
  }

  const title = `${product.title} - Artmate`;
  const url = routes.product(category.slug, product.slug);

  return {
    title: {
      absolute: title,
    },
    description: product.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description: product.description,
      url,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
      images: [
        {
          url: product.image,
          width: 1200,
          height: 1200,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: product.description,
      images: [product.image],
    },
  };
}

export default async function Page({ params }: ProductRouteProps) {
  const { categorySlug, productSlug } = await params;
  const category = getProductCategoryBySlug(categorySlug);
  const product = getProductBySlug(productSlug);

  if (!category || !product || product.categoryId !== category.id) {
    notFound();
  }

  return <ProductPage product={product} relatedProducts={getRelatedProducts(product)} />;
}
