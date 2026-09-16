"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";

export function useAffiliatePartner(userId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    affiliatePartnersQuery.detail(userId),
  );
  return { data, isError, isPending, refetch };
}
