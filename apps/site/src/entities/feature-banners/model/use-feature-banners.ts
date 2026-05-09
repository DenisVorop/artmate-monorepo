"use client";

import { useQuery } from "@tanstack/react-query";

import { featureBannersQuery } from "./query";

export function useFeatureBanners() {
  const { data, isError, isPending } = useQuery(featureBannersQuery.list());

  return {
    banners: data ?? [],
    isError,
    isPending,
  };
}
