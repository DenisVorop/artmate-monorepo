"use client";

import { useMutation } from "@tanstack/react-query";

import { logout } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useLogoutMutation() {
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await logout()).unwrap(),
  });

  return {
    mutate,
    isPending,
  };
}
