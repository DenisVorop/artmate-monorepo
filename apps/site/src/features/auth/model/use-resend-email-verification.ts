"use client";

import { useMutation } from "@tanstack/react-query";

import {
  resendEmailVerification,
  type ResendEmailVerificationInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useResendEmailVerificationMutation() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: ResendEmailVerificationInputDTO) =>
      ApiResult.fromDTO(await resendEmailVerification(input)).unwrap(),
  });

  return {
    mutate,
    isPending,
  };
}
