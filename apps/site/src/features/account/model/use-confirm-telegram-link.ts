"use client";

import { useAnalytics } from "../lib/analytics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery, telegramLinkStatusQueryKey } from "@/entities/session";
import {
  confirmTelegramLink,
  type AuthTelegramLinkResponseDTO,
  type ConfirmTelegramLinkInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
} from "@/shared/lib/query-keys";

type UseConfirmTelegramLinkOptions = {
  onSuccess?: (_response: AuthTelegramLinkResponseDTO | undefined) => void;
};

export function useConfirmTelegramLink(options: UseConfirmTelegramLinkOptions = {}) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const { mutateAsync: mutate, isPending } = useMutation({
    mutationFn: async (input: ConfirmTelegramLinkInputDTO) =>
      ApiResult.fromDTO(await confirmTelegramLink(input)).unwrap(),
    onError: () => analytics.telegramLinkFailed(),
    onSuccess: (response) => {
      if (response?.linked) analytics.telegramLinked();
      void queryClient.cancelQueries({ queryKey: featureBannersQueryKey });
      void queryClient.cancelQueries({ queryKey: welcomeOfferQueryKey });
      void queryClient.resetQueries({ queryKey: featureBannersQueryKey });
      void queryClient.resetQueries({ queryKey: welcomeOfferQueryKey });
      void queryClient.invalidateQueries({ queryKey: telegramLinkStatusQueryKey });
      void queryClient.invalidateQueries({ queryKey: sessionQuery.baseKey });
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.(response);
    },
  });

  return {
    mutate,
    isPending,
  };
}
