"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  affiliatePartnersQueryKeys,
  type AffiliateCode,
} from "@/entities/affiliate-partners";
import { promoCodesQueryKeys } from "@/entities/promocodes";
import {
  updateAffiliatePartnerCode,
  type UpdateAffiliateCodeInputDTO,
} from "@/shared/actions/affiliate-partners";

export function useUpdateAffiliateCode(options: {
  onSuccess: (code: AffiliateCode) => void;
}) {
  const queryClient = useQueryClient();
  const { error, isPending, mutate } = useMutation({
    mutationFn: async ({
      codeId,
      input,
      userId,
    }: {
      codeId: string;
      input: UpdateAffiliateCodeInputDTO;
      userId: string;
    }) => {
      const result = await updateAffiliatePartnerCode(userId, codeId, input);

      if (!result.ok) throw new Error(result.error);
      return { code: result.data, userId };
    },
    onSuccess: async ({ code, userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...affiliatePartnersQueryKeys.all, "codes", userId],
        }),
        queryClient.invalidateQueries({ queryKey: promoCodesQueryKeys.all }),
      ]);
      options.onSuccess(code);
    },
  });

  return {
    error: error instanceof Error ? error.message : null,
    isPending,
    mutate,
  };
}
