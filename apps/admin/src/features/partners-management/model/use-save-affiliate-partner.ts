"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliatePartnersQueryKeys } from "@/entities/affiliate-partners";
import { usersQueryKeys } from "@/entities/users";
import {
  updateAffiliatePartner,
  type UpdateAffiliatePartnerInputDTO,
} from "@/shared/actions/affiliate-partners";

export function useSaveAffiliatePartner(options: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const { error, isPending, mutate } = useMutation({
    mutationFn: async ({
      input,
      userId,
    }: {
      input: UpdateAffiliatePartnerInputDTO;
      userId: string;
    }) => {
      const result = await updateAffiliatePartner(userId, input);

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: async (partner) => {
      queryClient.setQueryData(
        affiliatePartnersQueryKeys.detail(partner.userId),
        partner,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: affiliatePartnersQueryKeys.all,
        }),
        queryClient.invalidateQueries({ queryKey: usersQueryKeys.all }),
      ]);
      options.onSuccess();
    },
  });

  return {
    error: error instanceof Error ? error.message : null,
    isPending,
    mutate,
  };
}
