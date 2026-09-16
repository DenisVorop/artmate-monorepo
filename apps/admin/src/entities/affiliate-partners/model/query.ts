import { queryOptions } from "@tanstack/react-query";

import {
  getAffiliatePartner,
  getAffiliatePartnerHistory,
  getAffiliatePartners,
} from "@/shared/actions/affiliate-partners";

import type { AffiliatePartnersListParams } from "./types";
import { collectAffiliatePartnerSelection } from "./selection";

export const affiliatePartnersQueryKeys = {
  all: ["admin-affiliate-partners"] as const,
  list: (params: AffiliatePartnersListParams) =>
    [...affiliatePartnersQueryKeys.all, "list", params] as const,
  detail: (userId: string) =>
    [...affiliatePartnersQueryKeys.all, "detail", userId] as const,
  history: (userId: string) =>
    [...affiliatePartnersQueryKeys.all, "history", userId] as const,
  selection: () => [...affiliatePartnersQueryKeys.all, "selection"] as const,
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
};
