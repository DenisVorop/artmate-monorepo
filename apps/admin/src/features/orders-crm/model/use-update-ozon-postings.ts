"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ordersQueryKeys, type AdminOrder } from "@/entities/orders";
import { updateAdminOrderOzonPostings } from "@/shared/actions/orders";

export function useUpdateOzonPostings() {
  const queryClient = useQueryClient();
  const { mutate, isPending, isError } = useMutation({
    meta: {
      successMessage: "Отправления сохранены",
      errorMessage: "Не удалось сохранить отправления",
    },
    mutationFn: async ({
      orderId,
      ozonPostings,
    }: {
      orderId: string;
      ozonPostings: AdminOrder["ozonPostings"];
    }) => {
      const result = await updateAdminOrderOzonPostings(orderId, ozonPostings);
      if (!result.ok) {
        if (result.status === 409) {
          throw new Error(
            "Одно из отправлений уже добавлено в другой заказ. Проверьте ссылки.",
          );
        }
        throw new Error(
          result.status === 401 || result.status === 403
            ? "Войдите в аккаунт администратора и попробуйте ещё раз."
            : "Не удалось сохранить отправления. Попробуйте ещё раз.",
        );
      }
      return result.data;
    },
    onSuccess: (updatedOrder) => {
      queryClient.setQueryData<AdminOrder[]>(
        ordersQueryKeys.board(),
        (orders) =>
          orders?.map((order) =>
            order.id === updatedOrder.id ? updatedOrder : order,
          ),
      );
      queryClient.setQueryData(
        ordersQueryKeys.detail(updatedOrder.id),
        updatedOrder,
      );
    },
  });
  return { mutate, isPending, isError };
}
