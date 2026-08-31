import { queryOptions } from "@tanstack/react-query";

import { previewPromoCode } from "@/shared/actions/promocodes";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

type PromoPreviewQueryInput = {
  accountIdentity: string;
  cartSignature: string;
  code: string;
};

export const promoCodeQuery = {
  baseKey: [...cartPricingQueryKey, "promocode-preview"] as const,
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
