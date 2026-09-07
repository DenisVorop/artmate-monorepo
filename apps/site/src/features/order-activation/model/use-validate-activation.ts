"use client";

import { useQuery } from "@tanstack/react-query";

import { validateOrderActivation } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useValidateActivation(token?: string) {
  const normalizedToken = token?.trim() ?? "";
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["order-activation", "validation", normalizedToken],
    queryFn: async () =>
      ApiResult.fromDTO(await validateOrderActivation({ token: normalizedToken })).unwrap(),
    enabled: Boolean(normalizedToken),
    retry: false,
    staleTime: 0,
  });

  return {
    validity: data,
    error,
    isFetching: Boolean(normalizedToken) && isFetching,
    refetch,
  };
}
