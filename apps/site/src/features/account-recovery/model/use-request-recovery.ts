"use client";

import { useMutation } from "@tanstack/react-query";

import {
  requestAccountRecovery,
  type RequestAccountRecoveryInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

import { useAnalytics } from "../lib/analytics";

type UseRequestRecoveryOptions = {
  onSuccess?: () => void;
};

export function useRequestRecovery(options: UseRequestRecoveryOptions = {}) {
  const analytics = useAnalytics();
  const { mutate, isPending, error } = useMutation({
    mutationFn: async (input: RequestAccountRecoveryInputDTO) =>
      ApiResult.fromDTO(await requestAccountRecovery(input)).unwrap(),
    onSuccess: () => {
      analytics.recoveryRequested();
      options.onSuccess?.();
    },
  });

  return { mutate, isPending, error };
}
