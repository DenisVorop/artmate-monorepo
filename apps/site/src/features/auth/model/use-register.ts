"use client";

import { useMutation } from "@tanstack/react-query";

import { register, type RegisterInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useRegisterMutation() {
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: RegisterInputDTO) =>
      ApiResult.fromDTO(await register(input)).unwrap(),
  });

  return {
    mutate,
    mutateAsync,
    isPending,
  };
}
