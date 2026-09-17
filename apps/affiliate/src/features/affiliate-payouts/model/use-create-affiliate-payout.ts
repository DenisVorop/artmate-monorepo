"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliateFinanceQueryKeys } from "@/entities/affiliate-finance";
import { affiliatePayoutQueryKeys } from "@/entities/affiliate-payout";
import {
  createAffiliatePayout,
  type CreateAffiliatePayoutInputDTO,
} from "@/shared/actions/affiliate";
import { useQueryOwnerId } from "@/shared/lib/query-owner";

export function useCreateAffiliatePayout() {
  const ownerId = useQueryOwnerId();
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    mutationFn: (input: CreateAffiliatePayoutInputDTO) =>
      createAffiliatePayout(input),
    onSuccess: async (result) => {
      if (!result.ok && result.error.status !== 409) return;

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: affiliatePayoutQueryKeys.all(ownerId),
        }),
        queryClient.invalidateQueries({
          queryKey: affiliateFinanceQueryKeys.all(ownerId),
        }),
      ]);
    },
    retry: 0,
  });

  return { isPending, mutate };
}
