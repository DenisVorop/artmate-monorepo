"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { clearStoredPromoCode } from "@/features/promocode";
import { clearCart } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { useAnalytics } from "../lib/analytics";
import { cartMutationScope, executeCartMutation } from "./cart-mutation";

export function useClearCartMutation() {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  const { mutate, isPending } = useMutation({
    scope: cartMutationScope,
    mutationFn: () =>
      executeCartMutation(queryClient, async () => ApiResult.fromDTO(await clearCart()).unwrap()),
    onSuccess: ({ cart, previousCart }) => {
      analytics.cartCleared(cart, previousCart);
      clearStoredPromoCode();
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
    },
  });

  return {
    mutate,
    isPending,
  };
}
