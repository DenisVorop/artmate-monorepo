"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import { logout } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

type UseLogoutMutationOptions = {
  onSuccess?: () => void;
};

export function useLogoutMutation(options: UseLogoutMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await logout()).unwrap(),
    onSuccess: () => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, { user: null });
      options.onSuccess?.();
    },
  });

  return {
    mutate,
    mutateAsync,
    isPending,
  };
}
