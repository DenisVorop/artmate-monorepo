import type { MetadataRoute } from "next";
import { CATEGORIES, PRODUCTS, getProductCategory } from "@/entities/products";
import { getAbsoluteUrl, routes } from "@/shared";

type SitemapEntry = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const staticRoutes = [
  {
    path: routes.home,
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: routes.catalog,
    changeFrequency: "weekly",
    priority: 0.9,
  },
  {
    path: routes.raskraski,
    changeFrequency: "weekly",
    priority: 0.85,
  },
  {
    path: routes.blog,
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    path: routes.contacts,
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    path: routes.faq,
    changeFrequency: "monthly",
    priority: 0.65,
  },
] satisfies SitemapEntry[];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const categoryRoutes = CATEGORIES.map((category) => ({
    path: routes.catalogCategory(category.slug),
    changeFrequency: "weekly",
    priority: 0.8,
  })) satisfies SitemapEntry[];
  const productRoutes = PRODUCTS.flatMap((product) => {
    const category = getProductCategory(product.categoryId);

    if (!category) {
      return [];
    }

    return [
      {
        path: routes.product(category.slug, product.slug),
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ];
  }) satisfies SitemapEntry[];

  return [...staticRoutes, ...categoryRoutes, ...productRoutes].map((route) => ({
    url: getAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
