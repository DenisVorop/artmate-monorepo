"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { unlinkTelegram, type AuthTelegramLinkStatusDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

import { telegramLinkStatusQueryKey } from "./use-telegram-link-status";

type UseUnlinkTelegramOptions = {
  onSuccess?: (_response: AuthTelegramLinkStatusDTO | undefined) => void;
};

export function useUnlinkTelegram(options: UseUnlinkTelegramOptions = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await unlinkTelegram()).unwrap(),
    onSuccess: (response) => {
      queryClient.setQueryData(telegramLinkStatusQueryKey, response);
      options.onSuccess?.(response);
    },
  });

  return {
    mutate,
    isPending,
  };
}
