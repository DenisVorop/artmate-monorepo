"use client";

import { useQuery } from "@tanstack/react-query";

import { getCdekCity } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useCdekCity(cityCode: number | undefined, enabled = true) {
  const isValidCityCode = Number.isInteger(cityCode) && (cityCode ?? 0) > 0;
  const shouldLoad = enabled && isValidCityCode;
  const result = useQuery({
    enabled: shouldLoad,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const city = ApiResult.fromDTO(await getCdekCity(cityCode ?? 0)).unwrap();
      if (!city || city.code !== cityCode) {
        throw new Error("Не удалось получить координаты выбранного города.");
      }
      return { city, cityCode };
    },
    queryKey: ["delivery", "cdek", "city", cityCode] as const,
    staleTime: 7 * 24 * 60 * 60_000,
  });
  const data = result.data;
  const city =
    shouldLoad && data && data.cityCode === cityCode && data.city.code === cityCode
      ? data.city
      : undefined;

  return {
    city,
    isError: shouldLoad && result.isError,
    isFetching: shouldLoad && result.isFetching,
    isPending: shouldLoad && result.isPending,
    retry: result.refetch,
  };
}
