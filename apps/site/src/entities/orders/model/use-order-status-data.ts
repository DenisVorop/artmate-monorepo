"use client";

import { useQuery } from "@tanstack/react-query";

import { ordersQuery } from "./query";

type UseOrderStatusDataOptions = {
  enabled?: boolean;
  orderId?: string;
  pollWhilePending?: boolean;
  refetchInterval?: false | number;
};

export function useOrderStatusData({
  enabled = true,
  orderId,
  pollWhilePending = false,
  refetchInterval,
}: UseOrderStatusDataOptions) {
  const { data, isError, isFetching, isPending } = useQuery({
    ...ordersQuery.getOrderStatus(orderId ?? ""),
    enabled: Boolean(orderId) && enabled,
    refetchInterval: pollWhilePending
      ? (query) => {
          const paymentStatus = query.state.data?.paymentStatus;

          return !paymentStatus || paymentStatus === "pending" ? 3000 : false;
        }
      : refetchInterval,
  });

  return {
    data,
    isError,
    isFetching,
    isPending: Boolean(orderId) && isPending,
  };
}
