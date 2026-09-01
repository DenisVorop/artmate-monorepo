"use client";

import { useQuery } from "@tanstack/react-query";

import { cartQuery } from "./query";

type UseCartDataOptions = {
  refreshOnMount?: boolean;
};

export function useCartData({ refreshOnMount = false }: UseCartDataOptions = {}) {
  const { data, isError, isFetchedAfterMount, isPending, isSuccess } = useQuery({
    ...cartQuery.getCart(),
    ...(refreshOnMount
      ? {
          refetchOnMount: "always" as const,
          retryOnMount: true,
        }
      : {}),
  });

  return { data, isError, isFetchedAfterMount, isPending, isSuccess };
}
