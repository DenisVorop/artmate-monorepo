"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";

export function useAffiliatePartnerHistory(userId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    affiliatePartnersQuery.history(userId),
  );
  return { history: data ?? [], isError, isPending, refetch };
}
