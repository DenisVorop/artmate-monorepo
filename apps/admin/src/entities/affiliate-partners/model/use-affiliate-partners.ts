"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";
import type { AffiliatePartnersListParams } from "./types";

export function useAffiliatePartners(params: AffiliatePartnersListParams) {
  const { data, isError, isFetching, isPending, refetch } = useQuery({
    ...affiliatePartnersQuery.list(params),
    placeholderData: keepPreviousData,
  });

  return { data, isError, isFetching, isPending, refetch };
}
