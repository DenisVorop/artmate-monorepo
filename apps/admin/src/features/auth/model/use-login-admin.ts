"use client";

import { useMutation } from "@tanstack/react-query";

import { loginAdmin, type LoginInputDTO } from "@/shared/actions/auth";

export function useLoginAdmin() {
  const { isPending, mutateAsync: mutate } = useMutation({
    meta: {
      disableToast: true,
    },
    mutationFn: (input: LoginInputDTO) => loginAdmin(input),
  });

  return { isPending, mutate };
}
