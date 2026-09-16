"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryOwnerId } from "@/shared/lib/query-owner";

import { affiliatePartnerQuery } from "./query";

export function useAffiliatePartnerData() {
  const ownerId = useQueryOwnerId();
  const { data, isError, isPending } = useQuery(affiliatePartnerQuery(ownerId));

  return { data, isError, isPending };
}
