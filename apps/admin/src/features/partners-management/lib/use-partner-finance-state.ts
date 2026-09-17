"use client";

import { useState } from "react";

import type { AffiliateFinanceDays } from "@/entities/affiliate-partners";

export const financePeriodOptions = [7, 30, 90] as const;
export const financeCodePageSize = 10;
export const financeLedgerPageSize = 20;

export function usePartnerFinanceState() {
  const [days, setDaysValue] = useState<AffiliateFinanceDays>(30);
  const [codePage, setCodePage] = useState(1);
  const [ledgerPage, setLedgerPage] = useState(1);

  const setDays = (value: AffiliateFinanceDays) => {
    setDaysValue(value);
    setCodePage(1);
    setLedgerPage(1);
  };

  return {
    codePage,
    days,
    ledgerPage,
    setCodePage,
    setDays,
    setLedgerPage,
  };
}
