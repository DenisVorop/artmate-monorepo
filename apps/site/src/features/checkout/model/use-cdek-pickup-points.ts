"use client";

import { useQuery } from "@tanstack/react-query";

import { getCdekPickupPoints } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useCdekPickupPoints(cityCode: number | undefined) {
  const result = useQuery({
    enabled: Boolean(cityCode),
    queryFn: async () => ApiResult.fromDTO(await getCdekPickupPoints(cityCode ?? 0)).unwrap() ?? [],
    queryKey: ["delivery", "cdek", "pickup-points", cityCode] as const,
    staleTime: 1000 * 60 * 10,
  });

  return {
    isError: result.isError,
    isPending: Boolean(cityCode) && result.isPending,
    pickupPoints: result.data ?? [],
  };
}
