"use client";

import { useQuery } from "@tanstack/react-query";

import { ordersQuery } from "./query";

type UseOrderDataOptions = {
  orderId?: string;
};

export function useOrderData({ orderId }: UseOrderDataOptions) {
  const { data, error, isError, isPending } = useQuery({
    ...ordersQuery.getOrder(orderId ?? ""),
    enabled: Boolean(orderId),
  });

  return {
    data,
    error,
    isError,
    isPending: Boolean(orderId) && isPending,
  };
}
