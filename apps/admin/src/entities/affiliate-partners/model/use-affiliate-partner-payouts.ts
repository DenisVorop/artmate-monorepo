"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";
import type { AffiliatePartnerPayoutsParams } from "./types";

export function useAffiliatePartnerPayouts(
  userId: string,
  params: AffiliatePartnerPayoutsParams,
) {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliatePartnersQuery.payouts(userId, params),
  );

  return { data, isError, isFetching, isPending, refetch };
}
