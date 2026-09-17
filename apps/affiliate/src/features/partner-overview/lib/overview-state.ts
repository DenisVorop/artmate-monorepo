import type { AffiliateAnalyticsDays } from "@/entities/affiliate-finance";

export type PartnerOverviewState = {
  readonly codePage: number;
  readonly days: AffiliateAnalyticsDays;
  readonly ledgerPage: number;
};

type PartnerOverviewAction =
  | { readonly days: AffiliateAnalyticsDays; readonly type: "period" }
  | { readonly page: number; readonly type: "code-page" }
  | { readonly page: number; readonly type: "ledger-page" };

export function createPartnerOverviewState(): PartnerOverviewState {
  return { codePage: 1, days: 30, ledgerPage: 1 };
}

export function partnerOverviewReducer(
  state: PartnerOverviewState,
  action: PartnerOverviewAction,
): PartnerOverviewState {
  switch (action.type) {
    case "period":
      return { codePage: 1, days: action.days, ledgerPage: 1 };
    case "code-page":
      return { ...state, codePage: action.page };
    case "ledger-page":
      return { ...state, ledgerPage: action.page };
  }
}
