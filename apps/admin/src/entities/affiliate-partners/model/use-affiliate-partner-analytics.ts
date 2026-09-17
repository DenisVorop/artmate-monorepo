"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";
import type { AffiliatePartnerAnalyticsParams } from "./types";

export function useAffiliatePartnerAnalytics(
  userId: string,
  params: AffiliatePartnerAnalyticsParams,
) {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliatePartnersQuery.analytics(userId, params),
  );

  return { data, isError, isFetching, isPending, refetch };
}
