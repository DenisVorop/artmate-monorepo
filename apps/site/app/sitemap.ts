import type { MetadataRoute } from "next";
import { getProductCategory } from "@/entities/products";
import { getBlogPosts } from "@/shared/actions/blog";
import { getCatalogLandingPages } from "@/shared/actions/catalog-landings";
import { getProductsData } from "@/shared/actions/products";
import { getAbsoluteUrl, routes } from "@/shared/constants";

export const dynamic = "force-dynamic";

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
    path: routes.paymentAndDelivery,
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: routes.faq,
    changeFrequency: "monthly",
    priority: 0.65,
  },
  {
    path: routes.legal.publicOffer,
    changeFrequency: "monthly",
    priority: 0.45,
  },
  {
    path: routes.legal.privacyPolicy,
    changeFrequency: "monthly",
    priority: 0.45,
  },
  {
    path: routes.legal.userAgreement,
    changeFrequency: "monthly",
    priority: 0.45,
  },
  {
    path: routes.legal.personalDataConsent,
    changeFrequency: "monthly",
    priority: 0.4,
  },
  {
    path: routes.legal.cookiePolicy,
    changeFrequency: "monthly",
    priority: 0.4,
  },
  {
    path: routes.legal.returnPolicy,
    changeFrequency: "monthly",
    priority: 0.45,
  },
] satisfies SitemapEntry[];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const [blogData, landingData, productsResult] = await Promise.all([
    getBlogPosts(),
    getCatalogLandingPages(),
    getProductsData(),
  ]);
  const productsData = productsResult.data;
  const blogPosts = blogData.data?.items ?? [];
  const catalogLandings = landingData.data ?? [];
  const blogRoutes = blogPosts.map((post) => ({
    path: routes.blogPost(post.id),
    changeFrequency: "weekly",
    priority: 0.65,
  })) satisfies SitemapEntry[];
  const categoryRoutes = (productsData?.categories ?? []).map((category) => ({
    path: routes.catalogCategory(category.slug),
    changeFrequency: "weekly",
    priority: 0.8,
  })) satisfies SitemapEntry[];
  const catalogLandingRoutes = catalogLandings.map((landing) => ({
    path: routes.catalogLanding(landing.slug),
    changeFrequency: "weekly",
    priority: 0.75,
  })) satisfies SitemapEntry[];
  const productRoutes = (productsData?.products ?? []).flatMap((product) => {
    const category = getProductCategory(productsData?.categories ?? [], product.categoryId);

    if (product.categoryId && !category) {
      return [];
    }

    return [
      {
        path: routes.product(category?.slug, product.slug),
        changeFrequency: "weekly",
        priority: 0.7,
      },
    ];
  }) satisfies SitemapEntry[];

  return [
    ...staticRoutes,
    ...blogRoutes,
    ...categoryRoutes,
    ...catalogLandingRoutes,
    ...productRoutes,
  ].map((route) => ({
    url: getAbsoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
