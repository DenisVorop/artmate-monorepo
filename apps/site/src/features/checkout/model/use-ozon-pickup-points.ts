"use client";

import { useQuery } from "@tanstack/react-query";

import { getOzonPickupPoints } from "@/shared/actions/delivery";
import { ApiResult } from "@/shared/lib/api-result";

export function useOzonPickupPoints(localityId: string | undefined) {
  const result = useQuery({
    enabled: Boolean(localityId),
    gcTime: 5 * 60_000,
    queryFn: async () => ({
      localityId,
      pickupPoints: ApiResult.fromDTO(await getOzonPickupPoints(localityId ?? "")).unwrap() ?? [],
    }),
    queryKey: ["delivery", "ozon", "pickup-points", localityId] as const,
    staleTime: 60_000,
  });
  const data = result.data;

  return {
    isError: result.isError,
    isPending: Boolean(localityId) && result.isPending,
    isFetching: Boolean(localityId) && result.isFetching,
    pickupPoints: data && data.localityId === localityId ? data.pickupPoints : [],
    retry: result.refetch,
  };
}
