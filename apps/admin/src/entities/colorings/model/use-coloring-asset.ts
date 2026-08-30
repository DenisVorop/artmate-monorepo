"use client";

import { useQuery } from "@tanstack/react-query";

import { coloringsQuery } from "./query";

type UseColoringAssetParams = {
  readonly previewUrl: string;
};

export function useColoringAsset({ previewUrl }: UseColoringAssetParams) {
  const { data, isError, isPending } = useQuery(
    coloringsQuery.asset(previewUrl),
  );

  return {
    dataUrl: data,
    isError,
    isPending,
  };
}
