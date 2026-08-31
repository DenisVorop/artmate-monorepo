"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import { login, type AuthSessionDTO, type LoginInputDTO } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
} from "@/shared/lib/query-keys";

type UseLoginMutationOptions = {
  onSuccess?: (_session: AuthSessionDTO | undefined) => void;
};

export function useLoginMutation(options: UseLoginMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async (input: LoginInputDTO) => ApiResult.fromDTO(await login(input)).unwrap(),
    onSuccess: (session) => {
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
