"use client";

import { useQuery } from "@tanstack/react-query";

import { ordersQuery } from "./query";

export function useOrders() {
  const { data, isError, isPending, refetch } = useQuery(ordersQuery.board());

  return {
    isError,
    isPending,
    orders: data ?? [],
    refetch,
  };
}
