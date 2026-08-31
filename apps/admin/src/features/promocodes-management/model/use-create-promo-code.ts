"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { promoCodesQueryKeys } from "@/entities/promocodes";
import { createAdminPromoCode } from "@/shared/actions/promocodes";

import type { PromoCodeMutationOptions } from "./mutation-options";

export function useCreatePromoCode({
  onSuccess,
}: PromoCodeMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать промокод",
      successMessage: "Промокод создан",
    },
    mutationFn: createAdminPromoCode,
    onSuccess: async (promoCode) => {
      queryClient.setQueryData(
        promoCodesQueryKeys.detail(promoCode.id),
        promoCode,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: promoCodesQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: promoCodesQueryKeys.detail(promoCode.id),
        }),
      ]);
      await onSuccess?.(promoCode);
    },
  });

  return { isPending, mutate };
}
