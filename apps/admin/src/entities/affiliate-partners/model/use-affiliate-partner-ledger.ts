"use client";

import { useQuery } from "@tanstack/react-query";

import { affiliatePartnersQuery } from "./query";
import type { AffiliatePartnerLedgerParams } from "./types";

export function useAffiliatePartnerLedger(
  userId: string,
  params: AffiliatePartnerLedgerParams,
) {
  const { data, isError, isFetching, isPending, refetch } = useQuery(
    affiliatePartnersQuery.ledger(userId, params),
  );

  return { data, isError, isFetching, isPending, refetch };
}
