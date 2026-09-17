"use client";

import { useState } from "react";

import { useAffiliatePartnerPayouts } from "@/entities/affiliate-partners";

const payoutPageSize = 10;

export function usePartnerPayoutsState(userId: string) {
  const [page, setPage] = useState(1);
  const payoutsQuery = useAffiliatePartnerPayouts(userId, {
    page,
    pageSize: payoutPageSize,
  });
  const totalPages = Math.max(
    1,
    Math.ceil((payoutsQuery.data?.total ?? 0) / payoutPageSize),
  );

  return { page, payoutsQuery, setPage, totalPages };
}
