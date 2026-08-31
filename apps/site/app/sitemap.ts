import type { MetadataRoute } from "next";
import { getProductCategory } from "@/entities/products";
import { getBlogPosts } from "@/shared/actions/blog";
import { getCatalogLandingPages } from "@/shared/actions/catalog-landings";
import { getPublicColoringCollections } from "@/shared/actions/coloring-collections";
import { getPublicColoringsManifest } from "@/shared/actions/colorings";
import { getProductsData } from "@/shared/actions/products";
import { getAbsoluteUrl, routes } from "@/shared/constants";
import { ensureApiResult } from "@/shared/lib/api-result";

export const dynamic = "force-dynamic";

type SitemapEntry = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  lastModified?: Date;
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
    path: routes.colorings,
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
  {
    path: routes.legal.promocodes,
    changeFrequency: "monthly",
    priority: 0.45,
  },
] satisfies SitemapEntry[];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [blogData, landingData, productsResult, coloringsResult, coloringCollectionsResult] =
    await Promise.all([
      getBlogPosts(),
      getCatalogLandingPages(),
      getProductsData(),
      getPublicColoringsManifest(),
      getPublicColoringCollections(),
    ]);
  const productsData = ensureApiResult(productsResult).data;
  const blogPosts = ensureApiResult(blogData).data?.items ?? [];
  const catalogLandings = ensureApiResult(landingData).data ?? [];
  const colorings = ensureApiResult(coloringsResult).data;
  const coloringCollections = ensureApiResult(coloringCollectionsResult).data;

  if (!colorings) {
    throw new Error("Public colorings manifest returned no data");
  }
  if (!coloringCollections) {
    throw new Error("Public coloring collections returned no data");
  }
  const blogRoutes = blogPosts.map((post) => ({
    path: routes.blogPost(post.slug),
    changeFrequency: "weekly",
    priority: 0.65,
    lastModified: getLatestDate(post.updatedAt, post.createdAt),
  })) satisfies SitemapEntry[];
  const categoryRoutes = (productsData?.categories ?? []).map((category) => {
    const categoryProducts = (productsData?.products ?? []).filter(
      (product) => product.categoryId === category.id,
    );

    return {
      path: routes.catalogCategory(category.slug),
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: getLatestDate(
        category.updatedAt,
        category.createdAt,
        ...categoryProducts.flatMap((product) => [product.updatedAt, product.createdAt]),
      ),
    };
  }) satisfies SitemapEntry[];
  const catalogLandingRoutes = catalogLandings.map((landing) => ({
    path: routes.catalogLanding(landing.slug),
    changeFrequency: "weekly",
    priority: 0.75,
    lastModified: getLatestDate(
      landing.updatedAt,
      landing.createdAt,
      ...landing.products.flatMap((product) => [product.updatedAt, product.createdAt]),
    ),
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
        lastModified: getLatestDate(
          product.updatedAt,
          product.createdAt,
          category?.updatedAt,
          category?.createdAt,
        ),
      },
    ];
  }) satisfies SitemapEntry[];
  const coloringRoutes = colorings.map((coloring) => ({
    path: routes.coloring(coloring.collectionSlug, coloring.number),
    changeFrequency: "monthly",
    priority: 0.6,
    lastModified: new Date(coloring.lastModified),
  })) satisfies SitemapEntry[];
  const coloringCollectionRoutes = coloringCollections.map((collection) => ({
    path: routes.coloringCollection(collection.slug),
    changeFrequency: "weekly",
    priority: 0.7,
    lastModified: new Date(collection.lastModified),
  })) satisfies SitemapEntry[];
  const blogLastModified = getLatestDate(...blogRoutes.map((route) => route.lastModified));
  const catalogLastModified = getLatestDate(
    ...categoryRoutes.map((route) => route.lastModified),
    ...catalogLandingRoutes.map((route) => route.lastModified),
    ...productRoutes.map((route) => route.lastModified),
  );
  const homeLastModified = getLatestDate(
    ...(productsData?.products ?? [])
      .filter((product) => product.isHit)
      .flatMap((product) => {
        const category = getProductCategory(productsData?.categories ?? [], product.categoryId);

        return [product.updatedAt, product.createdAt, category?.updatedAt, category?.createdAt];
      }),
  );
  const staticRoutesWithLastModified = staticRoutes.map((route) => ({
    ...route,
    lastModified:
      route.path === routes.home
        ? homeLastModified
        : route.path === routes.catalog
          ? catalogLastModified
          : route.path === routes.colorings
            ? getLatestDate(
                ...coloringCollections.map((collection) => collection.lastModified),
                ...coloringRoutes.map((route) => route.lastModified),
              )
            : route.path === routes.blog
              ? blogLastModified
              : undefined,
  })) satisfies SitemapEntry[];
  const uniqueRoutes = new Map<string, SitemapEntry>();

  for (const route of [
    ...staticRoutesWithLastModified,
    ...blogRoutes,
    ...categoryRoutes,
    ...catalogLandingRoutes,
    ...productRoutes,
    ...coloringCollectionRoutes,
    ...coloringRoutes,
  ]) {
    if (!uniqueRoutes.has(route.path)) {
      uniqueRoutes.set(route.path, route);
    }
  }

  return Array.from(uniqueRoutes.values()).map((route) => ({
    url: getAbsoluteUrl(route.path),
    ...(route.lastModified ? { lastModified: route.lastModified } : {}),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

function getLatestDate(...values: Array<Date | string | null | undefined>): Date | undefined {
  let latest: Date | undefined;

  for (const value of values) {
    if (!value) {
      continue;
    }

    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    if (!latest || date > latest) {
      latest = date;
    }
  }

  return latest;
}
