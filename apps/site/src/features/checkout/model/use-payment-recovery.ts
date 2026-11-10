"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation } from "@tanstack/react-query";

import { recoverOrderPayment } from "@/shared/actions/orders";
import { ApiResult } from "@/shared/lib/api-result";

type UsePaymentRecoveryOptions = {
  onSuccess?: (_redirectUrl: string | null) => void;
};

export function usePaymentRecovery(options: UsePaymentRecoveryOptions = {}) {
  const analytics = useAnalytics();
  const { data, error, isPending, mutate } = useMutation({
    mutationFn: async (orderId: string) => {
      analytics.paymentRecoveryRequested();
      const response = ApiResult.fromDTO(await recoverOrderPayment(orderId)).unwrap();
      if (!response) throw new Error("Не удалось проверить оплату");
      return response;
    },
    onSuccess: (response) => options.onSuccess?.(response.redirectUrl),
    onError: () => analytics.paymentRecoveryFailed(),
  });

  return {
    error,
    hasResult: data !== undefined,
    isPending,
    recoverPayment: mutate,
    redirectUrl: data?.redirectUrl,
  };
}
