"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";

export function useAffiliatePartnerSelection() {
  const { data, isError, isPending, refetch } = useQuery(
    affiliatePartnersQuery.selection(),
  );

  return {
    isError,
    isPending,
    partners: data ?? [],
    refetch,
  };
}
