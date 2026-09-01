"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { cartQuery } from "@/entities/cart";
import { addCartItem, type AddCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { useAnalytics } from "../lib/analytics";
import { cartMutationScope, executeCartMutation } from "./cart-mutation";

export function useAddCartItemMutation() {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();

  const { mutateAsync, isPending } = useMutation({
    scope: cartMutationScope,
    mutationFn: (input: AddCartItemInputDTO) =>
      executeCartMutation(queryClient, async () =>
        ApiResult.fromDTO(await addCartItem(input)).unwrap(),
      ),
    onSuccess: ({ cart, previousCart }, input) => {
      analytics.cartItemAdded(cart, input, previousCart);
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
    },
  });
  const mutate = useCallback(
    async (input: AddCartItemInputDTO) => (await mutateAsync(input)).cart,
    [mutateAsync],
  );

  return {
    mutate,
    isPending,
  };
}
