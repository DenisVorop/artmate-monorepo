"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import {
  confirmEmailVerification,
  type AuthSessionDTO,
  type ConfirmEmailVerificationInputDTO,
} from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
} from "@/shared/lib/query-keys";

type UseConfirmEmailVerificationMutationOptions = {
  onSignupConfirmed?: () => void;
  onSuccess?: (_session: AuthSessionDTO | undefined) => void;
};

export function useConfirmEmailVerificationMutation(
  options: UseConfirmEmailVerificationMutationOptions = {},
) {
  const queryClient = useQueryClient();
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: ConfirmEmailVerificationInputDTO) =>
      ApiResult.fromDTO(await confirmEmailVerification(input)).unwrap(),
    onSuccess: (session) => {
      if (session?.user) {
        options.onSignupConfirmed?.();
      }

      void queryClient.cancelQueries({ queryKey: featureBannersQueryKey });
      void queryClient.cancelQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.removeQueries({ queryKey: featureBannersQueryKey });
      queryClient.removeQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? { user: null });
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.(session);
    },
  });

  return {
    mutate,
    mutateAsync,
    isPending,
  };
}
