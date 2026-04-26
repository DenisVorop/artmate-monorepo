"use client";

import { useQuery } from "@tanstack/react-query";

import { ordersQuery } from "./query";

type UseOrdersDataOptions = {
  enabled?: boolean;
};

export function useOrdersData({ enabled = true }: UseOrdersDataOptions = {}) {
  const { data, isError, isPending } = useQuery({
    ...ordersQuery.getMyOrders(),
    enabled,
  });

  return {
    data: data ?? [],
    isError,
    isPending,
  };
}
