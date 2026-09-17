"use client";

import { useState } from "react";

import { useAffiliatePayoutsData } from "@/entities/affiliate-payout";

import { getPayoutDisplayState } from "./list-state";

const pageSize = 10;

export function useAffiliatePayouts() {
  const [page, setPage] = useState(1);
  const summaryQuery = useAffiliatePayoutsData(1, pageSize);
  const payouts = useAffiliatePayoutsData(page, pageSize);
  const display = getPayoutDisplayState(
    summaryQuery.data?.summary,
    payouts.data,
  );
  const isSummaryFresh = display.isSummaryFresh
    ? !payouts.isError && !payouts.isFetching
    : !summaryQuery.isError && !summaryQuery.isFetching;

  const refresh = async () => {
    await Promise.all([summaryQuery.refetch(), payouts.refetch()]);
  };

  return {
    isSummaryFresh,
    page,
    payouts,
    refresh,
    setPage,
    summary: display.summary,
    summaryQuery,
  };
}
