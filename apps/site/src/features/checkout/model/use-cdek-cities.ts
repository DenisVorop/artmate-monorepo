"use client";

import { useQuery } from "@tanstack/react-query";

import { searchCdekCities } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";
import { useDebouncedCityQuery } from "../lib/use-debounced-city-query";

export function useCdekCities(query: string, enabled = true) {
  const normalizedQuery = query.trim();
  const debouncedQuery = useDebouncedCityQuery(normalizedQuery);

  const shouldSearch = enabled && debouncedQuery.length >= 2;
  const isSettled = debouncedQuery === normalizedQuery;
  const result = useQuery({
    enabled: shouldSearch,
    gcTime: 5 * 60_000,
    queryFn: async () => ({
      cities: ApiResult.fromDTO(await searchCdekCities(debouncedQuery)).unwrap() ?? [],
      query: debouncedQuery,
    }),
    queryKey: ["delivery", "cdek", "cities", debouncedQuery] as const,
    staleTime: 1000 * 60 * 30,
  });
  const data = result.data;
  const hasCurrentResult = shouldSearch && isSettled && data?.query === normalizedQuery;

  return {
    cities: hasCurrentResult ? data.cities : [],
    isError: shouldSearch && isSettled && result.isError,
    isFetching: shouldSearch && isSettled && result.isFetching,
    isPending: enabled && normalizedQuery.length >= 2 && (!isSettled || result.isPending),
    retry: result.refetch,
  };
}
