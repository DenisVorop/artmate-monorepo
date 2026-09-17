"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  orderRefundsQueryKeys,
  type OrderRefunds,
} from "@/entities/order-refund";
import { ordersQueryKeys } from "@/entities/orders";
import {
  recordAdminOrderRefund,
  type RecordOrderRefundInputDTO,
} from "@/shared/actions/orders";

type RefundMutationError = Error & { status?: number };

type Options = {
  onError?: (error: RefundMutationError) => void;
  onSuccess?: (data: OrderRefunds) => void;
};

export function useRecordOrderRefund({ onError, onSuccess }: Options = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    mutationFn: async ({
      orderId,
      payload,
    }: {
      orderId: string;
      payload: RecordOrderRefundInputDTO;
    }) => {
      const result = await recordAdminOrderRefund(orderId, payload);
      if (!result.ok) {
        const error = new Error(result.error) as RefundMutationError;
        error.status = result.status;
        throw error;
      }
      return result.data;
    },
    onError,
    onSuccess: async (data: OrderRefunds) => {
      queryClient.setQueryData(
        orderRefundsQueryKeys.detail(data.orderId),
        data,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orderRefundsQueryKeys.detail(data.orderId),
        }),
        queryClient.invalidateQueries({
          queryKey: ordersQueryKeys.detail(data.orderId),
        }),
      ]);
      onSuccess?.(data);
    },
  });

  return { isPending, mutate };
}
