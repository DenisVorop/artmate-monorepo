"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { cartQuery } from "@/entities/cart";
import {
  createOrder,
  type CreateOrderResponseDTO,
} from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";
import { readYandexAttribution } from "@/shared/lib/analytics";
import { cartPricingQueryKey } from "@/shared/lib/query-keys";

import { useAnalytics } from "../lib/analytics";
import type { CheckoutProviderSubmitVariables } from "../lib/checkout-provider";

type UseCreateOrderMutationOptions = {
  onSuccess?: (_response: CreateOrderResponseDTO | undefined) => void;
};

export function useCreateOrderMutation(options: UseCreateOrderMutationOptions = {}) {
  const queryClient = useQueryClient();
  const analytics = useAnalytics();
  const {
    mutateAsync: createOrderMutationAsync,
    isPending,
    error,
  } = useMutation({
    mutationFn: async ({ input }: CheckoutProviderSubmitVariables) =>
      ApiResult.fromDTO(
        await createOrder(input, readYandexAttribution()),
      ).unwrap(),
    onSuccess: (response) => {
      if (!response) {
        throw new Error("Не удалось создать заказ. Попробуйте ещё раз.");
      }
      analytics.orderCreated({
        currency: "RUB",
        itemsCount: response.itemsCount,
        orderId: response.orderId,
        revenue: response.revenue,
      });
      if (!response.redirectUrl) {
        throw new Error("Не удалось открыть страницу оплаты. Попробуйте ещё раз.");
      }
      queryClient.setQueryData(cartQuery.getCart().queryKey, null);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.(response);
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
    },
  });

  return {
    createOrder: async (variables: CheckoutProviderSubmitVariables) =>
      createOrderMutationAsync(variables),
    isPending,
    error,
  };
}
