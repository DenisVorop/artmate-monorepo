"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { emptySession, sessionQuery } from "@/entities/session";
import { register, type RegisterInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useRegisterMutation() {
  const queryClient = useQueryClient();

  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: RegisterInputDTO) =>
      ApiResult.fromDTO(await register(input)).unwrap(),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? emptySession);
    },
  });

  return {
    mutate,
    isPending,
  };
}
