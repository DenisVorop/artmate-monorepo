"use client";

import { useQuery } from "@tanstack/react-query";

import { calculateCheckout } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useCheckoutCalculation(pickupPointAddress: string | undefined) {
  const { data, error, isError, isFetching, isPending, refetch } = useQuery({
    queryKey: ["checkout", "calculation", pickupPointAddress],
    queryFn: async () => {
      if (!pickupPointAddress) {
        throw new Error("pickupPointAddress is required");
      }

      return ApiResult.fromDTO(
        await calculateCheckout({
          delivery: {
            provider: "ozon",
            pickupPointAddress,
          },
        }),
      ).unwrap();
    },
    enabled: Boolean(pickupPointAddress),
    retry: 1,
    staleTime: 0,
  });

  return {
    data,
    error,
    isError,
    isFetching,
    isPending: Boolean(pickupPointAddress) && isPending,
    refetch,
  };
}
