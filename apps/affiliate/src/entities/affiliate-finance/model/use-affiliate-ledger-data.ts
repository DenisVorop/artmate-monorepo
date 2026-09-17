"use client";

import { useQuery } from "@tanstack/react-query";

import type { AffiliateAnalyticsDaysDTO } from "@/shared/actions/affiliate";
import { useQueryOwnerId } from "@/shared/lib/query-owner";

import { affiliateLedgerQuery } from "./query";

export function useAffiliateLedgerData(
  days: AffiliateAnalyticsDaysDTO,
  page: number,
  pageSize = 20,
) {
  const ownerId = useQueryOwnerId();
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliateLedgerQuery(ownerId, days, page, pageSize),
  );

  return { data, isError, isFetching, isPending, refetch };
}
