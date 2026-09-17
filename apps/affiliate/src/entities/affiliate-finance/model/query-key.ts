import type { AffiliateAnalyticsDaysDTO } from "@/shared/actions/affiliate";

export const affiliateFinanceQueryKeys = {
  analytics: (
    ownerId: string,
    days: AffiliateAnalyticsDaysDTO,
    codePage: number,
    codePageSize: number,
  ) =>
    [
      "affiliate-finance",
      ownerId,
      "analytics",
      { codePage, codePageSize, days },
    ] as const,
  ledger: (
    ownerId: string,
    days: AffiliateAnalyticsDaysDTO,
    page: number,
    pageSize: number,
  ) =>
    ["affiliate-finance", ownerId, "ledger", { days, page, pageSize }] as const,
};
