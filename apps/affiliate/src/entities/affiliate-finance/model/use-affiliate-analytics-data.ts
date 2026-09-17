"use client";

import { useQuery } from "@tanstack/react-query";

import type { AffiliateAnalyticsDaysDTO } from "@/shared/actions/affiliate";
import { useQueryOwnerId } from "@/shared/lib/query-owner";

import { affiliateAnalyticsQuery } from "./query";

export function useAffiliateAnalyticsData(
  days: AffiliateAnalyticsDaysDTO,
  codePage: number,
  codePageSize = 10,
) {
  const ownerId = useQueryOwnerId();
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliateAnalyticsQuery(ownerId, days, codePage, codePageSize),
  );

  return { data, isError, isFetching, isPending, refetch };
}
