"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  ordersQueryKeys,
  type AdminOrder,
  type OrderStatus,
} from "@/entities/orders";
import { updateAdminOrderStatus } from "@/shared/actions/orders";

import type { MutationOptions } from "./mutation-options";

type UpdateOrderCrmStatusVariables = {
  readonly status: OrderStatus;
  readonly orderId: string;
};

type MutationContext = {
  readonly previousOrders?: AdminOrder[];
};

export function useUpdateOrderCrmStatus({
  onSuccess,
}: MutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation<
    AdminOrder,
    Error,
    UpdateOrderCrmStatusVariables,
    MutationContext
  >({
    meta: {
      errorMessage: "Не удалось переместить заказ",
      successMessage: "Статус заказа обновлен",
    },
    mutationFn: ({ status, orderId }) =>
      updateAdminOrderStatus(orderId, { status }),
    onMutate: async ({ status, orderId }) => {
      await queryClient.cancelQueries({ queryKey: ordersQueryKeys.board() });
      const previousOrders = queryClient.getQueryData<AdminOrder[]>(
        ordersQueryKeys.board(),
      );

      queryClient.setQueryData<AdminOrder[]>(
        ordersQueryKeys.board(),
        (orders = []) =>
          orders.map((order) =>
            order.id === orderId ? { ...order, status } : order,
          ),
      );

      return { previousOrders };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(
          ordersQueryKeys.board(),
          context.previousOrders,
        );
      }
    },
    onSuccess: async (updatedOrder) => {
      queryClient.setQueryData<AdminOrder[]>(
        ordersQueryKeys.board(),
        (orders = []) =>
          orders.map((order) =>
            order.id === updatedOrder.id ? updatedOrder : order,
          ),
      );
      await onSuccess?.();
    },
  });

  return { isPending, mutate };
}
