"use client";

import { useQuery } from "@tanstack/react-query";

import { getFreshQueryData } from "@/shared/lib/query-freshness";

import { promoCodeQuery } from "./query";

type UsePromoPreviewInput = {
  accountIdentity: string;
  cartSignature: string;
  code?: string;
  enabled: boolean;
};

export function usePromoPreview({
  accountIdentity,
  cartSignature,
  code,
  enabled,
}: UsePromoPreviewInput) {
  const result = useQuery({
    ...promoCodeQuery.preview({ accountIdentity, cartSignature, code: code ?? "" }),
    enabled: enabled && Boolean(code),
  });
  const isPaused = result.fetchStatus === "paused" || result.isPaused;

  return {
    data: getFreshQueryData(result),
    error: result.error,
    isError: result.isError,
    isPaused: enabled && Boolean(code) && isPaused,
    isPending: enabled && Boolean(code) && (result.isFetching || isPaused),
    retry: result.refetch,
  };
}
