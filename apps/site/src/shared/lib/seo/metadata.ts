import type { Metadata } from "next";
import { siteConfig } from "@/shared/constants";

import { getSeoKeywords } from "./keywords";
import { seoPages } from "./registry";
import { createCategoryDescription, createProductDescription } from "./text";
import type {
  LegalSeoInput,
  MetadataInput,
  SeoBlogPost,
  SeoCategory,
  SeoPageKey,
  SeoProduct,
} from "./types";

export function createRootMetadata(): Metadata {
  return {
    metadataBase: new URL(siteConfig.url),
    applicationName: siteConfig.name,
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    keywords: getSeoKeywords("common", "products", "catalog"),
    creator: siteConfig.name,
    publisher: siteConfig.name,
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
    },
    robots: getIndexRobots(),
    openGraph: {
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export function createPageMetadata(pageKey: SeoPageKey): Metadata {
  return createMetadata(seoPages[pageKey]);
}

export function createLegalMetadata(document: LegalSeoInput): Metadata {
  const title = `${document.title} - ${siteConfig.name}`;

  return createMetadata({
    title,
    description: document.description,
    canonical: document.href,
    keywords: ["common", document.title, `${document.title} Artmate`, "документы Artmate"],
  });
}

export function createCategoryMetadata(category: SeoCategory): Metadata {
  const title = `${category.title} - раскраски по\u00a0номерам Artmate`;
  const description = createCategoryDescription(category.title);
  const canonical = `/catalog/raskraski/${category.slug}`;

  return createMetadata({
    title,
    description,
    canonical,
    image: {
      url: category.image,
      width: 900,
      height: 1200,
      alt: title,
    },
    keywords: [
      "common",
      "products",
      "catalog",
      category.title,
      `раскраски ${category.title}`,
      `раскраски по номерам ${category.title}`,
      `купить раскраски ${category.title}`,
    ],
  });
}

export function createProductMetadata(product: SeoProduct, category?: SeoCategory): Metadata {
  const title = `${product.title} - Artmate`;
  const description = createProductDescription(product);
  const canonical = category
    ? `/catalog/raskraski/${category.slug}/${product.slug}`
    : `/catalog/raskraski/${product.slug}`;

  return createMetadata({
    title,
    description,
    canonical,
    image: {
      url: product.image,
      width: 900,
      height: 1200,
      alt: product.title,
    },
    keywords: [
      "common",
      "products",
      "catalog",
      product.title,
      category?.title,
      product.category,
      `купить ${product.title}`,
      category ? `раскраска по номерам ${category.title}` : undefined,
    ],
  });
}

export function createBlogPostMetadata(post: SeoBlogPost): Metadata {
  const title = post.metaTitle ?? `${post.title} - Блог Artmate`;

  return createMetadata({
    title,
    description: post.metaDescription ?? post.excerpt,
    canonical: `/blog/${post.slug}`,
    ogType: "article",
    image: {
      url: post.image,
      width: 1200,
      height: 630,
      alt: post.imageAlt,
    },
    keywords: ["common", "blog", post.title, post.category, ...post.tags],
  });
}

function createMetadata(input: MetadataInput): Metadata {
  const title = {
    absolute: input.title,
  };

  if (input.noindex) {
    return {
      title,
      description: input.description,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const image = input.image ?? {
    url: siteConfig.ogImage,
    width: 1200,
    height: 630,
    alt: input.ogAlt ?? input.title,
  };

  return {
    title,
    description: input.description,
    keywords: getSeoKeywords(input.keywords),
    alternates: input.canonical
      ? {
          canonical: input.canonical,
        }
      : undefined,
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: input.ogType ?? "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [image.url],
    },
  };
}

function getIndexRobots(): NonNullable<Metadata["robots"]> {
  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}
