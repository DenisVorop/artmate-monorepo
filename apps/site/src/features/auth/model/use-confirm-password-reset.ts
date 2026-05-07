"use client";

import { useMutation } from "@tanstack/react-query";

import { confirmPasswordReset, type ConfirmPasswordResetInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useConfirmPasswordResetMutation() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: ConfirmPasswordResetInputDTO) =>
      ApiResult.fromDTO(await confirmPasswordReset(input)).unwrap(),
  });

  return {
    mutate,
    isPending,
  };
}
