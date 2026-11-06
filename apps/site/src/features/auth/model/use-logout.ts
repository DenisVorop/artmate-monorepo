"use client";

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { emailSubscriptionQuery } from "@/entities/email-subscription";
import { achievementQuery } from "@/entities/achievement";
import { sessionQuery } from "@/entities/session";
import { loyaltyQuery } from "@/entities/loyalty";
import { ordersQuery } from "@/entities/orders";
import { workshopQuery } from "@/entities/workshop";
import { logout } from "@/shared/actions/auth";
import { ApiResult } from "@/shared/lib/api-result";
import {
  cartPricingQueryKey,
  featureBannersQueryKey,
  welcomeOfferQueryKey,
  likesQueryKey,
} from "@/shared/lib/query-keys";

import { AuthContext } from "../lib/auth-provider/auth.context";

type UseLogoutMutationOptions = {
  onSuccess?: () => void;
};

export function useLogoutMutation(options: UseLogoutMutationOptions = {}) {
  const queryClient = useQueryClient();
  const coordinator = useContext(AuthContext);
  const { mutate, mutateAsync, isPending } = useMutation({
    mutationFn: async () => {
      await coordinator?.cancel();
      return ApiResult.fromDTO(await logout()).unwrap();
    },
    onSuccess: async () => {
      await queryClient.cancelQueries({ queryKey: sessionQuery.baseKey });
      await queryClient.cancelQueries({ queryKey: likesQueryKey });
      queryClient.removeQueries({ queryKey: likesQueryKey });
      void queryClient.cancelQueries({
        queryKey: emailSubscriptionQuery.baseKey,
      });
      queryClient.removeQueries({ queryKey: emailSubscriptionQuery.baseKey });
      void queryClient.cancelQueries({ queryKey: achievementQuery.baseKey });
      queryClient.removeQueries({ queryKey: achievementQuery.baseKey });
      void queryClient.cancelQueries({ queryKey: workshopQuery.baseKey });
      queryClient.removeQueries({ queryKey: workshopQuery.baseKey });
      void queryClient.cancelQueries({ queryKey: ordersQuery.baseKey });
      queryClient.removeQueries({ queryKey: ordersQuery.baseKey });
      void queryClient.cancelQueries({ queryKey: loyaltyQuery.baseKey });
      queryClient.removeQueries({ queryKey: loyaltyQuery.baseKey });
      void queryClient.cancelQueries({ queryKey: featureBannersQueryKey });
      void queryClient.cancelQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.removeQueries({ queryKey: featureBannersQueryKey });
      queryClient.removeQueries({ queryKey: welcomeOfferQueryKey });
      queryClient.setQueryData(sessionQuery.getSession().queryKey, {
        user: null,
      });
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
