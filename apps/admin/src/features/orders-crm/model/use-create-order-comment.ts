"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ordersQueryKeys, type AdminOrder } from "@/entities/orders";
import { createAdminOrderComment } from "@/shared/actions/orders";

import type { MutationOptions } from "./mutation-options";

type CreateOrderCommentVariables = {
  readonly body: string;
  readonly orderId: string;
};

export function useCreateOrderComment({ onSuccess }: MutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation<
    AdminOrder,
    Error,
    CreateOrderCommentVariables
  >({
    meta: {
      errorMessage: "Не удалось добавить комментарий",
      successMessage: "Комментарий добавлен",
    },
    mutationFn: async ({ body, orderId }) => {
      const result = await createAdminOrderComment(orderId, { body });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
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
