"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { confirmOrderPayment, type ConfirmOrderPaymentInputDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useConfirmOrderPaymentMutation() {
  const queryClient = useQueryClient();
  const {
    mutateAsync: confirmPayment,
    data: order,
    error,
    isError,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: async (input: ConfirmOrderPaymentInputDTO) =>
      ApiResult.fromDTO(await confirmOrderPayment(input)).unwrap(),
    onSuccess: () => {
      queryClient.setQueryData(cartQuery.getCart().queryKey, null);
    },
  });

  return {
    confirmPayment,
    order,
    error,
    isError,
    isPending,
    isSuccess,
  };
}
