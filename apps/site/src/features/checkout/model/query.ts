import { queryOptions } from "@tanstack/react-query";

import { calculateCheckout } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { isMatchingCheckoutCalculation } from "../lib/delivery-picker-state";
import type { CheckoutDeliverySelection } from "../lib/checkout-form";

const checkoutCalculationStaleTimeMs = 30_000;

export type CheckoutCalculationIdentity = {
  accountIdentity: string;
  cartId: string;
  cartSignature: string;
  promoCode?: string;
};

export function checkoutCalculationQueryKey(
  delivery: CheckoutDeliverySelection | undefined,
  { accountIdentity, cartId, cartSignature, promoCode }: CheckoutCalculationIdentity,
) {
  return [
    ...cartPricingQueryKey,
    "checkout-calculation",
    cartSignature,
    promoCode ?? null,
    accountIdentity,
    cartId,
    delivery,
  ] as const;
}

export function checkoutCalculationQueryOptions(
  delivery: CheckoutDeliverySelection | undefined,
  identity: CheckoutCalculationIdentity,
) {
  return queryOptions({
    queryFn: async () => {
      if (!delivery) throw new Error("Checkout delivery is required");

      const calculation = ApiResult.fromDTO(
        await calculateCheckout({ delivery, promoCode: identity.promoCode }),
      ).unwrap();

      if (!isMatchingCheckoutCalculation(calculation, delivery, identity.cartId)) {
        throw new Error("Checkout calculation does not match delivery");
      }

      return calculation;
    },
    queryKey: checkoutCalculationQueryKey(delivery, identity),
    retry: false,
    staleTime: checkoutCalculationStaleTimeMs,
  });
}
