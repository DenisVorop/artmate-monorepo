"use client";

import { useQuery } from "@tanstack/react-query";

import { ordersQuery } from "./query";

type UseOrdersDataOptions = {
  userId: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
};

export function useOrdersData({
  userId,
  limit = 20,
  offset = 0,
  enabled = true,
}: UseOrdersDataOptions) {
  const { data, isError, isPending } = useQuery({
    ...ordersQuery.getMyOrders(userId, limit, offset),
    enabled,
  });

  return {
    data: data ?? [],
    isError,
    isPending,
  };
}
