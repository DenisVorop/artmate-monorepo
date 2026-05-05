import type { Metadata } from "next";

import { getResolvedSeoMetadata, type SeoPayloadDTO } from "@/shared/actions/seo";
import { siteConfig } from "@/shared/constants";

type GetMetadataInput = {
  fallback?: Metadata;
  path: string;
};

type SeoImageMetadata = {
  alt?: string;
  height?: number;
  url: string;
  width?: number;
};

export const Seo = {
  getMetadata,
};

async function getMetadata({ fallback, path }: GetMetadataInput): Promise<Metadata> {
  const result = await getResolvedSeoMetadata(path);

  if (!result?.found || !result.metadata) {
    return fallback ?? {};
  }

  return mergeMetadata(fallback, createMetadataFromPayload(path, result.metadata));
}

function createMetadataFromPayload(path: string, payload: SeoPayloadDTO): Metadata {
  const openGraph = getRecord(payload.openGraph);
  const robots = getRecord(payload.robots);
  const title = getString(payload.title);
  const description = getString(payload.description);
  const canonical = getString(payload.canonical) ?? path;
  const image = getImage(openGraph?.image ?? payload.image);
  const ogTitle = getString(openGraph?.title) ?? title;
  const ogDescription = getString(openGraph?.description) ?? description;
  const ogImageAlt =
    getString(openGraph?.imageAlt) ?? getString(payload.imageAlt) ?? title;

  return {
    ...(title
      ? {
          title: {
            absolute: title,
          },
        }
      : {}),
    ...(description ? { description } : {}),
    ...(getKeywords(payload.keywords)
      ? { keywords: getKeywords(payload.keywords) }
      : {}),
    alternates: {
      canonical,
    },
    robots: getRobots(payload, robots),
    openGraph: {
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      url: canonical,
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      type: getOpenGraphType(openGraph?.type),
      ...(image
        ? {
            images: [
              {
                ...image,
                alt: image.alt ?? ogImageAlt,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

function mergeMetadata(fallback: Metadata | undefined, metadata: Metadata): Metadata {
  if (!fallback) {
    return metadata;
  }

  return {
    ...fallback,
    ...metadata,
    alternates: {
      ...fallback.alternates,
      ...metadata.alternates,
    },
    openGraph: {
      ...fallback.openGraph,
      ...metadata.openGraph,
    },
    robots: metadata.robots ?? fallback.robots,
    twitter: {
      ...fallback.twitter,
      ...metadata.twitter,
    },
  };
}

function getRobots(
  payload: SeoPayloadDTO,
  robots: Record<string, unknown> | undefined,
): Metadata["robots"] {
  const noindex = getBoolean(payload.noindex);
  const index = noindex ? false : getBoolean(robots?.index);
  const follow = noindex ? false : getBoolean(robots?.follow);

  if (index === undefined && follow === undefined) {
    return undefined;
  }

  return {
    ...(index !== undefined ? { index } : {}),
    ...(follow !== undefined ? { follow } : {}),
    googleBot: {
      ...(index !== undefined ? { index } : {}),
      ...(follow !== undefined ? { follow } : {}),
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

function getOpenGraphType(value: unknown) {
  return value === "article" ? "article" : "website";
}

function getKeywords(value: unknown) {
  if (Array.isArray(value)) {
    const keywords = value
      .map((item) => getString(item))
      .filter((item): item is string => Boolean(item));

    return keywords.length > 0 ? keywords : undefined;
  }

  const keywordString = getString(value);

  return keywordString
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getImage(value: unknown): SeoImageMetadata | undefined {
  const imageUrl = getString(value);

  if (imageUrl) {
    return {
      url: imageUrl,
    };
  }

  const image = getRecord(value);
  const url = getString(image?.url);

  if (!url) {
    return undefined;
  }

  return {
    url,
    alt: getString(image?.alt),
    width: getNumber(image?.width),
    height: getNumber(image?.height),
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getRecord(value: unknown) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
