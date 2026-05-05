"use server";

import type { SeoResolvedMetadataDTO } from "./seo.types";

const DEFAULT_API_BASE_URL = "http://localhost:3002";

export async function getResolvedSeoMetadata(path: string) {
  try {
    const response = await fetch(
      `${getApiBaseUrl()}/seo/resolve?path=${encodeURIComponent(path)}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as SeoResolvedMetadataDTO;
  } catch {
    return undefined;
  }
}

function getApiBaseUrl() {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
