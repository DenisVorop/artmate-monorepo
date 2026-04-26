"use client";

import { useQuery } from "@tanstack/react-query";

import { calculateCheckout } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useCheckoutCalculation(pickupPointId: string | undefined) {
  const { data, error, isError, isFetching, isPending, refetch } = useQuery({
    queryKey: ["checkout", "calculation", pickupPointId],
    queryFn: async () => {
      if (!pickupPointId) {
        throw new Error("pickupPointId is required");
      }

      return ApiResult.fromDTO(
        await calculateCheckout({
          delivery: {
            provider: "ozon",
            pickupPointId,
          },
        }),
      ).unwrap();
    },
    enabled: Boolean(pickupPointId),
    retry: 1,
    staleTime: 0,
  });

  return {
    data,
    error,
    isError,
    isFetching,
    isPending: Boolean(pickupPointId) && isPending,
    refetch,
  };
}
