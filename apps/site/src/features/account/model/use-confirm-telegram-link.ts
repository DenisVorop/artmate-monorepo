"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery, telegramLinkStatusQueryKey } from "@/entities/session";
import {
  confirmTelegramLink,
  type AuthTelegramLinkResponseDTO,
  type ConfirmTelegramLinkInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

type UseConfirmTelegramLinkOptions = {
  onSuccess?: (_response: AuthTelegramLinkResponseDTO | undefined) => void;
};

export function useConfirmTelegramLink(options: UseConfirmTelegramLinkOptions = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: ConfirmTelegramLinkInputDTO) =>
      ApiResult.fromDTO(await confirmTelegramLink(input)).unwrap(),
    onSuccess: (response) => {
      void queryClient.invalidateQueries({ queryKey: telegramLinkStatusQueryKey });
      void queryClient.invalidateQueries({ queryKey: sessionQuery.baseKey });
      options.onSuccess?.(response);
    },
  });

  return {
    mutate,
    isPending,
  };
}
