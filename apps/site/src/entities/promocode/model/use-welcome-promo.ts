"use client";

import { useQuery } from "@tanstack/react-query";

import { getFreshQueryData } from "@/shared/lib/query-freshness";

import { promoCodeQuery } from "./query";

type UseWelcomePromoInput = {
  enabled: boolean;
  userId: string;
};

export function useWelcomePromo({ enabled, userId }: UseWelcomePromoInput) {
  const shouldFetch = enabled && Boolean(userId);
  const result = useQuery({
    ...promoCodeQuery.welcome(userId),
    enabled: shouldFetch,
  });

  return {
    data: shouldFetch ? getFreshQueryData(result) : undefined,
    isPending: shouldFetch && (result.isPending || result.isFetching),
  };
}
