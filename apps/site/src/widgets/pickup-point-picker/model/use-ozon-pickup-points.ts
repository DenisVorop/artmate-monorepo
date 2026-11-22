"use client";

import { useQuery } from "@tanstack/react-query";

import { getOzonPickupPoints } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useOzonPickupPoints(cityCode: number | undefined, enabled: boolean) {
  const isValidCityCode = Number.isInteger(cityCode) && (cityCode ?? 0) > 0;
  const shouldLoad = enabled && isValidCityCode;
  const result = useQuery({
    enabled: shouldLoad,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const pickupPoints = ApiResult.fromDTO(await getOzonPickupPoints(cityCode ?? 0)).unwrap();
      if (!Array.isArray(pickupPoints)) {
        throw new Error("Не удалось загрузить пункты Ozon. Попробуйте ещё раз.");
      }
      return { cityCode, pickupPoints };
    },
    queryKey: ["delivery", "ozon", "pickup-points", cityCode] as const,
    staleTime: 45_000,
  });
  const data = result.data;
  const isCurrent = shouldLoad && data?.cityCode === cityCode;

  return {
    errorMessage: shouldLoad && result.error instanceof Error ? result.error.message : undefined,
    hasData: Boolean(isCurrent),
    isError: shouldLoad && result.isError && !result.isFetching,
    isFetching: shouldLoad && result.isFetching,
    isPending: shouldLoad && !isCurrent && (result.isPending || result.isFetching),
    pickupPoints: isCurrent && data ? data.pickupPoints : [],
    retry: result.refetch,
  };
}
