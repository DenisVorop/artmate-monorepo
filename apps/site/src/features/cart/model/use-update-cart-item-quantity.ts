"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { updateCartItemQuantity, type UpdateCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";

export function useUpdateCartItemQuantityMutation() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async (input: UpdateCartItemInputDTO) =>
      ApiResult.fromDTO(await updateCartItemQuantity(input)).unwrap(),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
    },
  });

  return {
    mutate,
    isPending,
  };
}
