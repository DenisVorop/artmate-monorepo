import { queryOptions } from "@tanstack/react-query";

import {
  getWelcomeOffer,
  getWelcomePromoCode,
  previewPromoCode,
} from "@/shared/actions/promocodes";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey, welcomeOfferQueryKey } from "@/shared/lib/query-keys";

type PromoPreviewQueryInput = {
  accountIdentity: string;
  cartSignature: string;
  code: string;
};

const welcomeOfferRefetchIntervalMs = 30_000;

export const promoCodeQuery = {
  baseKey: [...cartPricingQueryKey, "promocode-preview"] as const,
  welcome: (userId: string) =>
    queryOptions({
      queryKey: [...cartPricingQueryKey, "welcome-promocode", userId] as const,
      queryFn: async () => ApiResult.fromDTO(await getWelcomePromoCode()).unwrap(),
      retry: false,
      retryOnMount: false,
      staleTime: 0,
    }),
  welcomeOffer: (owner: string) =>
    queryOptions({
      queryKey: [...welcomeOfferQueryKey, owner] as const,
      queryFn: async () => ApiResult.fromDTO(await getWelcomeOffer()).unwrap(),
      retry: false,
      retryOnMount: false,
      staleTime: welcomeOfferRefetchIntervalMs,
      refetchInterval: welcomeOfferRefetchIntervalMs,
      refetchIntervalInBackground: false,
    }),
  preview: ({ accountIdentity, cartSignature, code }: PromoPreviewQueryInput) =>
    queryOptions({
      queryKey: [
        ...cartPricingQueryKey,
        "promocode-preview",
        cartSignature,
        code,
        accountIdentity,
      ] as const,
      queryFn: async () => ApiResult.fromDTO(await previewPromoCode({ code })).unwrap(),
      retry: false,
      staleTime: 0,
    }),
};
