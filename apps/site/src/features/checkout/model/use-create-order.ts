"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import {
  createOrder,
  type CreateOrderInputDTO,
  type OrderDTO,
} from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

type UseCreateOrderMutationOptions = {
  onSuccess?: (_order: OrderDTO | undefined) => void;
};

export function useCreateOrderMutation(options: UseCreateOrderMutationOptions = {}) {
  const queryClient = useQueryClient();
  const {
    mutate: createOrderMutation,
    mutateAsync: createOrderMutationAsync,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (input: CreateOrderInputDTO) =>
      ApiResult.fromDTO(await createOrder(input)).unwrap(),
    onSuccess: (order) => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, null);
      options.onSuccess?.(order);
    },
  });

  return {
    createOrder: createOrderMutation,
    createOrderAsync: createOrderMutationAsync,
    isPending,
    error,
  };
}
