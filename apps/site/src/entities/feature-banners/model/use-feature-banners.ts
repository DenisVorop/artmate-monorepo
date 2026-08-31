"use client";

import { useQuery } from "@tanstack/react-query";

import { featureBannersQuery } from "./query";

type UseFeatureBannersInput = {
  enabled: boolean;
  owner: string;
};

export function useFeatureBanners({ enabled, owner }: UseFeatureBannersInput) {
  const result = useQuery({
    ...featureBannersQuery.list(owner),
    enabled,
  });
  const data =
    enabled && !result.isError && !result.isPaused && result.fetchStatus !== "paused"
      ? result.data
      : undefined;

  return {
    banners: data ?? [],
    isError: enabled && result.isError,
    isPending: enabled && result.isPending,
  };
}
