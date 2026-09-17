import { queryOptions } from "@tanstack/react-query";

import {
  getAffiliatePartner,
  getAffiliatePartnerAnalytics,
  getAffiliatePartnerCodes,
  getAffiliatePartnerHistory,
  getAffiliatePartners,
  getAffiliatePartnerLedger,
} from "@/shared/actions/affiliate-partners";

import type {
  AffiliateCodesListParams,
  AffiliatePartnersListParams,
  AffiliatePartnerAnalyticsParams,
  AffiliatePartnerLedgerParams,
} from "./types";
import { collectAffiliatePartnerSelection } from "./selection";

export const affiliatePartnersQueryKeys = {
  all: ["admin-affiliate-partners"] as const,
  finance: () => [...affiliatePartnersQueryKeys.all, "finance"] as const,
  list: (params: AffiliatePartnersListParams) =>
    [...affiliatePartnersQueryKeys.all, "list", params] as const,
  detail: (userId: string) =>
    [...affiliatePartnersQueryKeys.all, "detail", userId] as const,
  history: (userId: string) =>
    [...affiliatePartnersQueryKeys.all, "history", userId] as const,
  codes: (userId: string, params: AffiliateCodesListParams) =>
    [...affiliatePartnersQueryKeys.all, "codes", userId, params] as const,
  selection: () => [...affiliatePartnersQueryKeys.all, "selection"] as const,
  analytics: (userId: string, params: AffiliatePartnerAnalyticsParams) =>
    [
      ...affiliatePartnersQueryKeys.finance(),
      "analytics",
      userId,
      params,
    ] as const,
  ledger: (userId: string, params: AffiliatePartnerLedgerParams) =>
    [
      ...affiliatePartnersQueryKeys.finance(),
      "ledger",
      userId,
      params,
    ] as const,
};

export const affiliatePartnersQuery = {
  list: (params: AffiliatePartnersListParams) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.list(params),
      queryFn: () => getAffiliatePartners(params),
      staleTime: 30_000,
      retryOnMount: false,
    }),
  selection: () =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.selection(),
      queryFn: () => collectAffiliatePartnerSelection(getAffiliatePartners),
      staleTime: 30_000,
      retryOnMount: false,
    }),
  detail: (userId: string) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.detail(userId),
      queryFn: () => getAffiliatePartner(userId),
      enabled: Boolean(userId),
      staleTime: 30_000,
      retryOnMount: false,
    }),
  history: (userId: string) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.history(userId),
      queryFn: () => getAffiliatePartnerHistory(userId),
      enabled: Boolean(userId),
      staleTime: 30_000,
      retryOnMount: false,
    }),
  codes: (userId: string, params: AffiliateCodesListParams) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.codes(userId, params),
      queryFn: () => getAffiliatePartnerCodes(userId, params),
      enabled: Boolean(userId),
      staleTime: 30_000,
      retryOnMount: false,
    }),
  analytics: (userId: string, params: AffiliatePartnerAnalyticsParams) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.analytics(userId, params),
      queryFn: () => getAffiliatePartnerAnalytics(userId, params),
      enabled: Boolean(userId),
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retryOnMount: false,
    }),
  ledger: (userId: string, params: AffiliatePartnerLedgerParams) =>
    queryOptions({
      queryKey: affiliatePartnersQueryKeys.ledger(userId, params),
      queryFn: () => getAffiliatePartnerLedger(userId, params),
      enabled: Boolean(userId),
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retryOnMount: false,
    }),
};
