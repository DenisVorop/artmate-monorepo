import { queryOptions } from "@tanstack/react-query";

import {
  getAdminPromoCode,
  getAdminPromoCodes,
} from "@/shared/actions/promocodes";

const promoCodesStaleTimeMs = 15_000;
const promoCodesRefreshIntervalMs = 30_000;

export const promoCodesQueryKeys = {
  all: ["admin-promocodes"] as const,
  detail: (promoCodeId: string) =>
    [...promoCodesQueryKeys.all, "detail", promoCodeId] as const,
  list: () => [...promoCodesQueryKeys.all, "list"] as const,
};

export const promoCodesQuery = {
  detail: (promoCodeId: string) =>
    queryOptions({
      queryKey: promoCodesQueryKeys.detail(promoCodeId),
      queryFn: () => getAdminPromoCode(promoCodeId),
      staleTime: promoCodesStaleTimeMs,
      refetchInterval: promoCodesRefreshIntervalMs,
      retryOnMount: false,
    }),
  list: () =>
    queryOptions({
      queryKey: promoCodesQueryKeys.list(),
      queryFn: getAdminPromoCodes,
      staleTime: promoCodesStaleTimeMs,
      refetchInterval: promoCodesRefreshIntervalMs,
      retryOnMount: false,
    }),
};
