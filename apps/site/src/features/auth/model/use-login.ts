"use client";

import { useMutation } from "@tanstack/react-query";

import { login, type LoginInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useLoginMutation() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: LoginInputDTO) =>
      ApiResult.fromDTO(await login(input)).unwrap(),
  });

  return {
    mutate,
    isPending,
  };
}
