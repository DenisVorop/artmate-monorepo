"use client";

import { useQuery } from "@tanstack/react-query";

import { getFreshQueryData } from "@/shared/lib/query-freshness";

import type { CheckoutDeliverySelection } from "../lib/checkout-form";

import { checkoutCalculationQueryOptions, type CheckoutCalculationIdentity } from "./query";

type UseCheckoutCalculationIdentity = CheckoutCalculationIdentity & {
  enabled: boolean;
};

export function useCheckoutCalculation(
  delivery: CheckoutDeliverySelection | undefined,
  { enabled, ...identity }: UseCheckoutCalculationIdentity,
) {
  const result = useQuery({
    ...checkoutCalculationQueryOptions(delivery, identity),
    enabled: Boolean(delivery) && enabled,
  });
  const isPaused = result.fetchStatus === "paused" || result.isPaused;

  return {
    calculation: getFreshQueryData(result),
    error: result.error,
    isError: result.isError,
    isPaused: Boolean(delivery) && enabled && isPaused,
    isPending: Boolean(delivery) && enabled && result.isFetching && !isPaused,
    retry: result.refetch,
  };
}
