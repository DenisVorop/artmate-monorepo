import { Injectable } from "@nestjs/common";

import type { BlogPostBlock } from "../blog/blog.types";

import type { AiGeneratedBlogDraft } from "./content-assistant.types";

const defaultUnsplashUtmSource = "artmate_blog";
const unsplashApiBaseUrl = "https://api.unsplash.com";
const unsplashFallbackQuery = "coloring book art supplies";

type UnsplashPhoto = {
  alt_description?: string | null;
  description?: string | null;
  links?: {
    download_location?: string;
    html?: string;
  };
  urls?: {
    regular?: string;
  };
  user?: {
    links?: {
      html?: string;
    };
    name?: string;
  };
};

@Injectable()
export class UnsplashImageService {
  async enrichDraft({
    draft,
    query,
  }: {
    draft: AiGeneratedBlogDraft;
    query: string;
  }): Promise<AiGeneratedBlogDraft> {
    const accessKey = getOptionalString(process.env.UNSPLASH_ACCESS_KEY);

    if (!accessKey) {
      return draft;
    }

    const photos = await this.searchPhotos({
      accessKey,
      query: getOptionalString(query) ?? unsplashFallbackQuery,
      seed: draft.slug || draft.title,
    });

    if (photos.length === 0) {
      return draft;
    }

    const heroPhoto = photos[0];

    if (!heroPhoto) {
      return draft;
    }

    const filledContent = fillImageBlocks({
      blocks: draft.content.blocks,
      photos,
      title: draft.title,
    });

    void this.trackDownloads({
      accessKey,
      photos: [heroPhoto, ...filledContent.usedPhotos],
    });

    return {
      ...draft,
      content: {
        schemaVersion: 1,
        blocks: filledContent.blocks,
      },
      imageAlt: heroPhoto.alt,
      imageUrl: heroPhoto.url,
    };
  }

  private async searchPhotos({
    accessKey,
    query,
    seed,
  }: {
    accessKey: string;
    query: string;
    seed: string;
  }): Promise<EnrichedUnsplashPhoto[]> {
    const params = new URLSearchParams({
      content_filter: "high",
      orientation: "landscape",
      order_by: "relevant",
      page: String((hashText(seed) % 3) + 1),
      per_page: "12",
      query,
    });
    const response = await fetch(
      `${unsplashApiBaseUrl}/search/photos?${params.toString()}`,
      {
        headers: getUnsplashHeaders(accessKey),
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { results?: UnsplashPhoto[] };
    const photos = (payload.results ?? [])
      .map(mapUnsplashPhoto)
      .filter((photo): photo is EnrichedUnsplashPhoto => Boolean(photo));

    if (photos.length > 0) {
      return rotateItems(photos, hashText(seed));
    }

    if (query === unsplashFallbackQuery) {
      return [];
    }

    return this.searchPhotos({ accessKey, query: unsplashFallbackQuery, seed });
  }

  private async trackDownload({
    accessKey,
    downloadLocation,
  }: {
    accessKey: string;
    downloadLocation: string;
  }) {
    try {
      await fetch(downloadLocation, {
        headers: getUnsplashHeaders(accessKey),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      // The image URL is still valid; download tracking must not block drafts.
    }
  }

  private async trackDownloads({
    accessKey,
    photos,
  }: {
    accessKey: string;
    photos: EnrichedUnsplashPhoto[];
  }) {
    const downloadLocations = Array.from(
      new Set(photos.map((photo) => photo.downloadLocation)),
    );

    await Promise.all(
      downloadLocations.map((downloadLocation) =>
        this.trackDownload({ accessKey, downloadLocation }),
      ),
    );
  }
}

type EnrichedUnsplashPhoto = {
  alt: string;
  attribution: string;
  downloadLocation: string;
  url: string;
};

function fillImageBlocks({
  blocks,
  photos,
  title,
}: {
  blocks: BlogPostBlock[];
  photos: EnrichedUnsplashPhoto[];
  title: string;
}): { blocks: BlogPostBlock[]; usedPhotos: EnrichedUnsplashPhoto[] } {
  let photoIndex = 0;
  const usedPhotos: EnrichedUnsplashPhoto[] = [];

  const filledBlocks = blocks.map((block) => {
    if (block.type !== "image" || block.src.trim()) {
      return block;
    }

    const photo = photos[photoIndex % photos.length];
    photoIndex += 1;

    if (!photo) {
      return block;
    }

    usedPhotos.push(photo);

    return {
      ...block,
      alt: block.alt.trim() || photo.alt || title,
      caption: block.caption?.trim() || photo.attribution,
      src: photo.url,
    };
  });

  return { blocks: filledBlocks, usedPhotos };
}

function mapUnsplashPhoto(
  photo: UnsplashPhoto,
): EnrichedUnsplashPhoto | null {
  const url = getOptionalString(photo.urls?.regular);
  const downloadLocation = getOptionalString(photo.links?.download_location);

  if (!url || !downloadLocation) {
    return null;
  }

  const photographer = getOptionalString(photo.user?.name) ?? "Unsplash";
  const utmSource =
    getOptionalString(process.env.UNSPLASH_UTM_SOURCE) ??
    defaultUnsplashUtmSource;
  const photographerUrl =
    getOptionalString(photo.user?.links?.html) ??
    getOptionalString(photo.links?.html);
  const attribution = photographerUrl
    ? `Фото: ${photographer} на Unsplash (${appendUtmSource(photographerUrl, utmSource)})`
    : `Фото: ${photographer} / Unsplash`;

  return {
    alt:
      getOptionalString(photo.alt_description) ??
      getOptionalString(photo.description) ??
      "Творческий процесс",
    attribution,
    downloadLocation,
    url,
  };
}

function getUnsplashHeaders(accessKey: string) {
  return {
    "Accept-Version": "v1",
    Authorization: `Client-ID ${accessKey}`,
  };
}

function appendUtmSource(url: string, utmSource: string) {
  const parsedUrl = new URL(url);

  parsedUrl.searchParams.set("utm_source", utmSource);
  parsedUrl.searchParams.set("utm_medium", "referral");

  return parsedUrl.toString();
}

function rotateItems<T>(items: T[], offset: number) {
  const normalizedOffset = offset % items.length;

  return [...items.slice(normalizedOffset), ...items.slice(0, normalizedOffset)];
}

function hashText(value: string) {
  let hash = 0;

  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function getOptionalString(value: string | null | undefined) {
  const text = value?.trim();

  return text || undefined;
}
