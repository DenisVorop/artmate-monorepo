"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { clearCart } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";

export function useClearCartMutation() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await clearCart()).unwrap(),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
    },
  });

  return {
    mutate,
    isPending,
  };
}
