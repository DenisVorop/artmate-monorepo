"use client";

import { useQuery } from "@tanstack/react-query";

import { searchCdekCities } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useCdekCities(query: string) {
  const normalizedQuery = query.trim();
  const result = useQuery({
    enabled: normalizedQuery.length >= 2,
    queryFn: async () => ApiResult.fromDTO(await searchCdekCities(normalizedQuery)).unwrap() ?? [],
    queryKey: ["delivery", "cdek", "cities", normalizedQuery] as const,
    staleTime: 1000 * 60 * 30,
  });

  return {
    cities: normalizedQuery.length >= 2 ? (result.data ?? []) : [],
    isError: result.isError,
    isPending: normalizedQuery.length >= 2 && result.isPending,
  };
}
