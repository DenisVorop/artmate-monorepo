"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import {
  confirmEmailVerification,
  type ConfirmEmailVerificationInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

export function useConfirmEmailVerificationMutation() {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: ConfirmEmailVerificationInputDTO) =>
      ApiResult.fromDTO(await confirmEmailVerification(input)).unwrap(),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? { user: null });
    },
  });

  return {
    mutate,
    isPending,
  };
}
