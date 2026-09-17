import { queryOptions } from "@tanstack/react-query";

import {
  getAffiliateAnalytics,
  getAffiliateLedger,
  type AffiliateAnalyticsDaysDTO,
} from "@/shared/actions/affiliate";

import { affiliateFinanceQueryKeys } from "./query-key";

export function affiliateAnalyticsQuery(
  ownerId: string,
  days: AffiliateAnalyticsDaysDTO = 30,
  codePage = 1,
  codePageSize = 10,
) {
  return queryOptions({
    queryKey: affiliateFinanceQueryKeys.analytics(
      ownerId,
      days,
      codePage,
      codePageSize,
    ),
    queryFn: () => getAffiliateAnalytics(days, codePage, codePageSize),
    refetchOnWindowFocus: true,
    retry: false,
    retryOnMount: false,
    staleTime: 30_000,
  });
}

export function affiliateLedgerQuery(
  ownerId: string,
  days: AffiliateAnalyticsDaysDTO = 30,
  page = 1,
  pageSize = 20,
) {
  return queryOptions({
    queryKey: affiliateFinanceQueryKeys.ledger(ownerId, days, page, pageSize),
    queryFn: () => getAffiliateLedger(days, page, pageSize),
    refetchOnWindowFocus: true,
    retry: false,
    retryOnMount: false,
    staleTime: 30_000,
  });
}
