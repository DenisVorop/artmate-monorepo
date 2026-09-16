"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { login, type LoginInputDTO } from "@/shared/actions/auth";

export function useLogin() {
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    mutationFn: (input: LoginInputDTO) => login(input),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.clear();
      }
    },
  });

  return { isPending, mutate };
}
