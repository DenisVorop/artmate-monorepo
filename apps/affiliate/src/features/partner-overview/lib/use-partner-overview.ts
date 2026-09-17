"use client";

import { useReducer } from "react";

import {
  useAffiliateAnalyticsData,
  useAffiliateLedgerData,
  type AffiliateAnalyticsDays,
} from "@/entities/affiliate-finance";

import {
  createPartnerOverviewState,
  partnerOverviewReducer,
} from "./overview-state";

const codePageSize = 10;
const ledgerPageSize = 20;

export function usePartnerOverview() {
  const [state, dispatch] = useReducer(
    partnerOverviewReducer,
    undefined,
    createPartnerOverviewState,
  );
  const analytics = useAffiliateAnalyticsData(
    state.days,
    state.codePage,
    codePageSize,
  );
  const ledger = useAffiliateLedgerData(
    state.days,
    state.ledgerPage,
    ledgerPageSize,
  );

  return {
    analytics,
    codePage: state.codePage,
    days: state.days,
    ledger,
    ledgerPage: state.ledgerPage,
    refresh: () => Promise.all([analytics.refetch(), ledger.refetch()]),
    setCodePage: (page: number) => dispatch({ page, type: "code-page" }),
    setDays: (days: AffiliateAnalyticsDays) =>
      dispatch({ days, type: "period" }),
    setLedgerPage: (page: number) => dispatch({ page, type: "ledger-page" }),
  };
}
