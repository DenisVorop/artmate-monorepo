"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import { logout } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await logout()).unwrap(),
    onSuccess: () => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, { user: null });
    },
  });

  return {
    mutate,
    isPending,
  };
}
