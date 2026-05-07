"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { createOrder, type CreateOrderInputDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  const {
    mutateAsync: createOrderMutation,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (input: CreateOrderInputDTO) =>
      ApiResult.fromDTO(await createOrder(input)).unwrap(),
    onSuccess: () => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, null);
    },
  });

  return {
    createOrder: createOrderMutation,
    isPending,
    error,
  };
}
