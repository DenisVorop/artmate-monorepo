"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryOwnerId } from "@/shared/lib/query-owner";

import { affiliatePayoutsQuery } from "./query";

export function useAffiliatePayoutsData(page = 1, pageSize = 10) {
  const ownerId = useQueryOwnerId();
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliatePayoutsQuery(ownerId, page, pageSize),
  );

  return { data, isError, isFetching, isPending, refetch };
}
