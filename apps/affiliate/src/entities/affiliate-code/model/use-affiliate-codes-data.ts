"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryOwnerId } from "@/shared/lib/query-owner";

import { affiliateCodesQuery } from "./query";

export function useAffiliateCodesData(page: number, pageSize = 20) {
  const ownerId = useQueryOwnerId();
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliateCodesQuery(ownerId, page, pageSize),
  );

  return { data, isError, isFetching, isPending, refetch };
}
