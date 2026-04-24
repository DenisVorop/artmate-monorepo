"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { removeCartItem, type RemoveCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";

export function useRemoveCartItemMutation() {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: async (input: RemoveCartItemInputDTO) =>
      ApiResult.fromDTO(await removeCartItem(input)).unwrap(),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
    },
  });

  return {
    mutate,
    isPending,
  };
}
