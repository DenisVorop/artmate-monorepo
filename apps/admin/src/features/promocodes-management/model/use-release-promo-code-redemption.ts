"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ordersQueryKeys } from "@/entities/orders";
import { promoCodesQueryKeys } from "@/entities/promocodes";
import {
  releaseAdminPromoCodeRedemption,
  type ReleasePromoCodeRedemptionInputDTO,
} from "@/shared/actions/promocodes";

import type { PromoCodeMutationOptions } from "./mutation-options";

type ReleasePromoCodeVariables = {
  readonly input: ReleasePromoCodeRedemptionInputDTO;
  readonly orderId: string;
  readonly promoCodeId: string;
};

export function useReleasePromoCodeRedemption({
  onSuccess,
}: PromoCodeMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { error, isPending, mutate, reset } = useMutation({
    meta: {
      errorMessage: "Не удалось снять резерв промокода",
      successMessage: "Резерв промокода снят",
    },
    mutationFn: async ({
      input,
      orderId,
      promoCodeId,
    }: ReleasePromoCodeVariables) => {
      const result = await releaseAdminPromoCodeRedemption(
        promoCodeId,
        orderId,
        input,
      );

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: async (promoCode, { orderId }) => {
      queryClient.setQueryData(
        promoCodesQueryKeys.detail(promoCode.id),
        promoCode,
      );
      await onSuccess?.(promoCode);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promoCodesQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: promoCodesQueryKeys.detail(promoCode.id),
        }),
        queryClient.invalidateQueries({ queryKey: ordersQueryKeys.board() }),
        queryClient.invalidateQueries({
          queryKey: ordersQueryKeys.detail(orderId),
        }),
      ]);
    },
  });

  return { errorMessage: error?.message, isPending, mutate, reset };
}
