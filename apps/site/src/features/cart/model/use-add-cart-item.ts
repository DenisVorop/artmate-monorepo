"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { addCartItem, type AddCartItemInputDTO } from "@/shared/actions/cart";
import { ApiResult } from "@/shared/lib/api-result";

export function useAddCartItemMutation() {
  const queryClient = useQueryClient();

  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: AddCartItemInputDTO) =>
      ApiResult.fromDTO(await addCartItem(input)).unwrap(),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, cart ?? null);
    },
  });

  return {
    mutate,
    isPending,
  };
}
