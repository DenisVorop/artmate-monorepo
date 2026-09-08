"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { ordersQuery } from "@/entities/orders";
import { sessionQuery } from "@/entities/session";
import {
  confirmOrderActivation,
  type ConfirmOrderActivationInputDTO,
} from "@/shared/actions/auth";
import { routes } from "@/shared/constants";
import { ApiResult } from "@/shared/lib/api-result";

import { useAnalytics } from "../lib/analytics";
import { isCurrentActivationToken } from "../lib/activation-state";

export function useConfirmActivation(currentToken: string) {
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const router = useRouter();
  const currentTokenRef = useRef(currentToken);
  currentTokenRef.current = currentToken;
  const { mutate, isPending, error, variables } = useMutation({
    mutationFn: async (input: ConfirmOrderActivationInputDTO) =>
      ApiResult.fromDTO(await confirmOrderActivation(input)).unwrap(),
    onSuccess: async (session, input) => {
      if (!isCurrentActivationToken(input.token, currentTokenRef.current)) {
        return;
      }

      await queryClient.cancelQueries({ queryKey: ordersQuery.baseKey });
      if (!isCurrentActivationToken(input.token, currentTokenRef.current)) {
        return;
      }
      queryClient.removeQueries({ queryKey: ordersQuery.baseKey });
      queryClient.setQueryData(sessionQuery.getSession().queryKey, session ?? { user: null });
      analytics.activationCompleted();
      router.replace(routes.account);
    },
  });
  const isCurrentMutation = isCurrentActivationToken(variables?.token, currentToken);

  return {
    mutate,
    isPending: isCurrentMutation && isPending,
    error: isCurrentMutation ? error : undefined,
  };
}
