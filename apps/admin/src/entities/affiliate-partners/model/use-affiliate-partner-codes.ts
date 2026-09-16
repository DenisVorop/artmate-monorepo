"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";
import type { AffiliateCodesListParams } from "./types";

export function useAffiliatePartnerCodes(
  userId: string,
  params: AffiliateCodesListParams,
) {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliatePartnersQuery.codes(userId, params),
  );

  return { data, isError, isFetching, isPending, refetch };
}
