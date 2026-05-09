"use client";

import { useQuery } from "@tanstack/react-query";

import { getTelegramLinkStatus } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";

type UseTelegramLinkStatusOptions = {
  enabled?: boolean;
};

export const telegramLinkStatusQueryKey = ["account", "telegram-link"] as const;

export function useTelegramLinkStatus(options: UseTelegramLinkStatusOptions = {}) {
  const { data, isError, isPending } = useQuery({
    queryKey: telegramLinkStatusQueryKey,
    queryFn: async () => ApiResult.fromDTO(await getTelegramLinkStatus()).unwrap(),
    enabled: options.enabled,
    staleTime: 1000 * 30,
  });

  return {
    data,
    isError,
    isPending,
  };
}
