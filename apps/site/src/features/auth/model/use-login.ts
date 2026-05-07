"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import { login, type AuthSessionDTO, type LoginInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

type UseLoginMutationOptions = {
  onSuccess?: (_session: AuthSessionDTO | undefined) => void;
};

export function useLoginMutation(options: UseLoginMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: LoginInputDTO) => ApiResult.fromDTO(await login(input)).unwrap(),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? { user: null });
      options.onSuccess?.(session);
    },
  });

  return {
    mutate,
    mutateAsync,
    isPending,
  };
}
