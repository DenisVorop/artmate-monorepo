import { queryOptions } from "@tanstack/react-query";

import {
  getMyWorkshop,
  getMyWorkshopCollection,
  getMyWorkshopColoring,
  getMyWorkshopTools,
  getOwnerRevisionAssetDataUrl,
  getWorkshopMarkerColors,
} from "@/shared/actions/workshops";
import { ApiResult } from "@/shared/lib/api-result";

import {
  ownerWorkshopCollectionSchema,
  ownerWorkshopColoringSchema,
  ownerWorkshopSchema,
  workshopMarkerColorsSchema,
  workshopToolsSchema,
} from "./schemas";

const baseKey = "workshop";

export const workshopQuery = {
  baseKey: [baseKey] as const,
  owner: () =>
    queryOptions({
      queryKey: [baseKey, "owner"] as const,
      queryFn: async () => ownerWorkshopSchema.parse(unwrap(await getMyWorkshop())),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  collection: (slug: string) =>
    queryOptions({
      queryKey: [baseKey, "collection", slug] as const,
      queryFn: async () =>
        ownerWorkshopCollectionSchema.parse(unwrap(await getMyWorkshopCollection(slug))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  coloring: (slug: string, number: number) =>
    queryOptions({
      queryKey: [baseKey, "coloring", slug, number] as const,
      queryFn: async () =>
        ownerWorkshopColoringSchema.parse(unwrap(await getMyWorkshopColoring(slug, number))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  tools: () =>
    queryOptions({
      queryKey: [baseKey, "tools"] as const,
      queryFn: async () => workshopToolsSchema.parse(unwrap(await getMyWorkshopTools())),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  markerColors: () =>
    queryOptions({
      queryKey: [baseKey, "marker-colors"] as const,
      queryFn: async () =>
        workshopMarkerColorsSchema.parse(unwrap(await getWorkshopMarkerColors())),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  ownerAsset: (revisionId: string, variant: "normalized" | "web" | "thumb") =>
    queryOptions({
      queryKey: [baseKey, "owner-asset", revisionId, variant] as const,
      queryFn: async () => unwrapString(await getOwnerRevisionAssetDataUrl(revisionId, variant)),
      staleTime: Infinity,
      retryOnMount: false,
    }),
};

function unwrap(result: Awaited<ReturnType<typeof getMyWorkshop>>) {
  return ApiResult.fromDTO(result).unwrap();
}

function unwrapString(result: Awaited<ReturnType<typeof getOwnerRevisionAssetDataUrl>>) {
  const value = ApiResult.fromDTO(result).unwrap();

  if (typeof value !== "string") {
    throw new Error("Workshop asset response did not contain an image");
  }

  return value;
}
