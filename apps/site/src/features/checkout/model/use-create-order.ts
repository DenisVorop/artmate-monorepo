"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import { createOrder, type CreateOrderInputDTO, type OrderDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { useAnalytics } from "../lib/analytics";

type UseCreateOrderMutationOptions = {
  onSuccess?: (_order: OrderDTO | undefined) => void;
};

export function useCreateOrderMutation(options: UseCreateOrderMutationOptions = {}) {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const {
    mutate: createOrderMutation,
    mutateAsync: createOrderMutationAsync,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (input: CreateOrderInputDTO) =>
      ApiResult.fromDTO(await createOrder(input)).unwrap(),
    onSuccess: (order) => {
      analytics.orderCreated(order);
      queryClient.setQueryData(cartQuery.getCart().queryKey, null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.(order);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
    },
  });

  return {
    createOrder: createOrderMutation,
    createOrderAsync: createOrderMutationAsync,
    isPending,
    error,
  };
}
