"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { telegramLinkStatusQueryKey } from "@/entities/session";
import { unlinkTelegram, type AuthTelegramLinkStatusDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
} from "@/shared/lib/query-keys";

type UseUnlinkTelegramOptions = {
  onSuccess?: (_response: AuthTelegramLinkStatusDTO | undefined) => void;
};

export function useUnlinkTelegram(options: UseUnlinkTelegramOptions = {}) {
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await unlinkTelegram()).unwrap(),
    onSuccess: (response) => {
      void queryClient.cancelQueries({ queryKey: featureBannersQueryKey });
      void queryClient.cancelQueries({ queryKey: welcomeOfferQueryKey });
      void queryClient.resetQueries({ queryKey: featureBannersQueryKey });
      void queryClient.resetQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.setQueryData(telegramLinkStatusQueryKey, response);
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.(response);
    },
  });

  return {
    mutate,
    isPending,
  };
}
