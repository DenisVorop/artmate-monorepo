"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { promoCodesQueryKeys } from "@/entities/promocodes";
import {
  updateAdminPromoCode,
  type UpdatePromoCodeInputDTO,
} from "@/shared/actions/promocodes";

import type { PromoCodeMutationOptions } from "./mutation-options";

type UpdatePromoCodeVariables = {
  readonly input: UpdatePromoCodeInputDTO;
  readonly promoCodeId: string;
};

export function useUpdatePromoCode({
  onSuccess,
}: PromoCodeMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить промокод",
      successMessage: "Промокод сохранён",
    },
    mutationFn: ({ input, promoCodeId }: UpdatePromoCodeVariables) =>
      updateAdminPromoCode(promoCodeId, input),
    onSuccess: async (promoCode) => {
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
      ]);
    },
  });

  return { isPending, mutate };
}
