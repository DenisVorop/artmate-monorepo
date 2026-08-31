"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { sessionQuery } from "@/entities/session";
import { logout } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
} from "@/shared/lib/query-keys";

type UseLogoutMutationOptions = {
  onSuccess?: () => void;
};

export function useLogoutMutation(options: UseLogoutMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async () => ApiResult.fromDTO(await logout()).unwrap(),
    onSuccess: () => {
      void queryClient.cancelQueries({ queryKey: featureBannersQueryKey });
      void queryClient.cancelQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.removeQueries({ queryKey: featureBannersQueryKey });
      queryClient.removeQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.setQueryData(sessionQuery.getSession().queryKey, { user: null });
      void queryClient.invalidateQueries({ queryKey: cartPricingQueryKey });
      options.onSuccess?.();
    },
  });

  return {
    mutate,
    mutateAsync,
    isPending,
  };
}
