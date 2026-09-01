"use client";

import { useQuery } from "@tanstack/react-query";

import { communityWorkQuery } from "./query";

export function usePublicWorkAsset(publicId: string, variant: "web" | "thumb" = "thumb") {
  const { data, isError, isPending } = useQuery(communityWorkQuery.asset(publicId, variant));

  return { dataUrl: data, isError, isPending };
}
