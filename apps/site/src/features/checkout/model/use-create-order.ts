"use client";

import { useMutation } from "@tanstack/react-query";

import { createOrder, type CreateOrderInputDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useCreateOrderMutation() {
  const {
    mutateAsync: createOrderMutation,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (input: CreateOrderInputDTO) =>
      ApiResult.fromDTO(await createOrder(input)).unwrap(),
  });

  return {
    createOrder: createOrderMutation,
    isPending,
    error,
  };
}
