"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { clearStoredPromoCode } from "@/features/promocode";
import { updateCartItemQuantity, type UpdateCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { useAnalytics } from "../lib/analytics";
import { cartMutationScope, executeCartMutation } from "./cart-mutation";

export function useUpdateCartItemQuantityMutation() {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  const { mutate, isPending } = useMutation({
    scope: cartMutationScope,
    mutationFn: (input: UpdateCartItemInputDTO) =>
      executeCartMutation(queryClient, async () =>
        ApiResult.fromDTO(await updateCartItemQuantity(input)).unwrap(),
      ),
    onSuccess: ({ cart, previousCart }, input) => {
      analytics.cartItemQuantityUpdated(cart, input, previousCart);

      if (!cart || cart.items.length === 0) {
        clearStoredPromoCode();
      }

      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
    },
  });

  return {
    mutate,
    isPending,
  };
}
