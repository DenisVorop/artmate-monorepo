"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { clearStoredPromoCode } from "@/features/promocode";
import { clearCart } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

export function useClearCartMutation() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await clearCart()).unwrap(),
    onSuccess: (cart) => {
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
