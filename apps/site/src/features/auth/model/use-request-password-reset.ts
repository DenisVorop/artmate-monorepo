"use client";

import { useMutation } from "@tanstack/react-query";

import { requestPasswordReset, type RequestPasswordResetInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useRequestPasswordResetMutation() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: RequestPasswordResetInputDTO) =>
      ApiResult.fromDTO(await requestPasswordReset(input)).unwrap(),
  });

  return {
    mutate,
    isPending,
  };
}
