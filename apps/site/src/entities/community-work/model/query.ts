import { queryOptions } from "@tanstack/react-query";

import {
  getCommunityWorksForColoring,
  getPublicCommunityWork,
  getPublicWorkshop,
  getPublicWorkAssetDataUrl,
} from "@/shared/actions/workshops";
import { ApiResult, type ApiResultDTO } from "@/shared/lib/api-result";

import { communityWorksSchema, publicCommunityWorkSchema, publicWorkshopSchema } from "./schemas";

const baseKey = "community-work";

export const communityWorkQuery = {
  baseKey: [baseKey] as const,
  workshop: (handle: string) =>
    queryOptions({
      queryKey: [baseKey, "workshop", handle] as const,
      queryFn: async () => publicWorkshopSchema.parse(unwrap(await getPublicWorkshop(handle))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  work: (publicId: string) =>
    queryOptions({
      queryKey: [baseKey, "work", publicId] as const,
      queryFn: async () =>
        publicCommunityWorkSchema.parse(unwrap(await getPublicCommunityWork(publicId))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  forColoring: (slug: string, number: number) =>
    queryOptions({
      queryKey: [baseKey, "coloring", slug, number] as const,
      queryFn: async () =>
        communityWorksSchema.parse(unwrap(await getCommunityWorksForColoring(slug, number))),
      staleTime: Infinity,
      retryOnMount: false,
    }),
  asset: (publicId: string, variant: "web" | "thumb") =>
    queryOptions({
      queryKey: [baseKey, "asset", publicId, variant] as const,
      queryFn: async () => unwrapString(await getPublicWorkAssetDataUrl(publicId, variant)),
      staleTime: Infinity,
      retryOnMount: false,
    }),
};

function unwrap(result: ApiResultDTO<unknown>) {
  return ApiResult.fromDTO(result).unwrap();
}

function unwrapString(result: ApiResultDTO<string>) {
  const value = ApiResult.fromDTO(result).unwrap();

  if (typeof value !== "string") {
    throw new Error("Community work asset response did not contain an image");
  }

  return value;
}
