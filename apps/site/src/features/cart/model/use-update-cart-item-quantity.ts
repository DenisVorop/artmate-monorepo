"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { clearStoredPromoCode } from "@/features/promocode";
import { updateCartItemQuantity, type UpdateCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

export function useUpdateCartItemQuantityMutation() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async (input: UpdateCartItemInputDTO) =>
      ApiResult.fromDTO(await updateCartItemQuantity(input)).unwrap(),
    onSuccess: (cart) => {
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
