"use client";

import { useQuery } from "@tanstack/react-query";

import { searchOzonCities } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useOzonCities(query: string, enabled = true) {
  const normalizedQuery = query.trim();
  const shouldSearch = enabled && normalizedQuery.length >= 2;

  const result = useQuery({
    enabled: shouldSearch,
    gcTime: 5 * 60_000,
    queryFn: async () => ApiResult.fromDTO(await searchOzonCities(normalizedQuery)).unwrap() ?? [],
    queryKey: ["delivery", "ozon", "cities", normalizedQuery] as const,
    staleTime: 60_000,
  });

  return {
    cities: shouldSearch ? (result.data ?? []) : [],
    isError: shouldSearch && result.isError,
    isPending: shouldSearch && result.isPending,
    isFetching: shouldSearch && result.isFetching,
    retry: result.refetch,
  };
}
