"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { emptySession, sessionQuery } from "@/entities/session";
import { login, type LoginInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useLoginMutation() {
  const queryClient = useQueryClient();

  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: LoginInputDTO) =>
      ApiResult.fromDTO(await login(input)).unwrap(),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? emptySession);
    },
  });

  return {
    mutate,
    isPending,
  };
}
