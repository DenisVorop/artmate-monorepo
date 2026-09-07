"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { searchCdekCities } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useCdekCities(query: string) {
  const normalizedQuery = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState(normalizedQuery);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 300);

    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);

  const result = useQuery({
    enabled: debouncedQuery.length >= 2,
    queryFn: async () => ApiResult.fromDTO(await searchCdekCities(debouncedQuery)).unwrap() ?? [],
    queryKey: ["delivery", "cdek", "cities", debouncedQuery] as const,
    staleTime: 1000 * 60 * 30,
  });

  return {
    cities:
      debouncedQuery === normalizedQuery && normalizedQuery.length >= 2 ? (result.data ?? []) : [],
    isError: result.isError,
    isPending:
      normalizedQuery.length >= 2 && (debouncedQuery !== normalizedQuery || result.isPending),
  };
}
