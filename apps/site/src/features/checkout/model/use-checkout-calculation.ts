"use client";

import { useQuery } from "@tanstack/react-query";

import { calculateCheckout, type CalculateCheckoutInputDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";
import { getFreshQueryData } from "@/shared/lib/query-freshness";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

type CheckoutCalculationIdentity = {
  accountIdentity: string;
  cartSignature: string;
  enabled: boolean;
  promoCode?: string;
};

export function useCheckoutCalculation(
  delivery: CalculateCheckoutInputDTO["delivery"] | undefined,
  { accountIdentity, cartSignature, enabled, promoCode }: CheckoutCalculationIdentity,
) {
  const result = useQuery({
    enabled: Boolean(delivery) && enabled,
    queryFn: async () => {
      if (!delivery) {
        return undefined;
      }

      return ApiResult.fromDTO(await calculateCheckout({ delivery, promoCode })).unwrap();
    },
    queryKey: [
      ...cartPricingQueryKey,
      "checkout-calculation",
      cartSignature,
      promoCode ?? null,
      accountIdentity,
      delivery,
    ] as const,
    retry: false,
    staleTime: 0,
  });
  const isPaused = result.fetchStatus === "paused" || result.isPaused;

  return {
    calculation: getFreshQueryData(result),
    error: result.error,
    isError: result.isError,
    isPaused: Boolean(delivery) && enabled && isPaused,
    isPending: Boolean(delivery) && enabled && (result.isFetching || isPaused),
    retry: result.refetch,
  };
}
