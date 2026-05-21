"use client";

import { useQuery } from "@tanstack/react-query";

import { calculateCheckout, type CalculateCheckoutInputDTO } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

export function useCheckoutCalculation(
  delivery: CalculateCheckoutInputDTO["delivery"] | undefined,
) {
  const result = useQuery({
    enabled: Boolean(delivery),
    queryFn: async () => {
      if (!delivery) {
        return undefined;
      }

      return ApiResult.fromDTO(await calculateCheckout({ delivery })).unwrap();
    },
    queryKey: ["checkout", "calculation", delivery] as const,
    staleTime: 1000 * 60 * 5,
  });

  return {
    calculation: result.data,
    error: result.error,
    isError: result.isError,
    isPending: Boolean(delivery) && result.isPending,
  };
}
