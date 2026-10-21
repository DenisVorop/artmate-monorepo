"use client";

import { useQuery } from "@tanstack/react-query";
import { emailSubscriptionQuery } from "./query";

export function useEmailSubscriptionData(ownerId: string, enabled: boolean) {
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    ...emailSubscriptionQuery.status(ownerId),
    enabled: enabled && Boolean(ownerId),
  });
  return {
    data: enabled && !isError ? data : undefined,
    isPending,
    isFetching,
    isError,
    retry: refetch,
  };
}
