"use client";

import { useQuery } from "@tanstack/react-query";

import { orderRefundsQuery } from "./query";

export function useOrderRefundsData(orderId: string) {
  const { data, isError, isPending, refetch } = useQuery(
    orderRefundsQuery(orderId),
  );

  return { data, isError, isPending, refetch };
}
