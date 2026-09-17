"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  affiliatePartnersQueryKeys,
  type AffiliatePayout,
} from "@/entities/affiliate-partners";
import {
  rejectAffiliatePartnerPayout,
  type RejectAffiliatePayoutInputDTO,
} from "@/shared/actions/affiliate-partners";

import type { PayoutMutationError } from "./use-record-affiliate-payout";

export function useRejectAffiliatePayout(options: {
  onError: (error: PayoutMutationError) => void;
  onSuccess: (payout: AffiliatePayout) => void;
}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    mutationFn: async ({
      input,
      payoutId,
      userId,
    }: {
      input: RejectAffiliatePayoutInputDTO;
      payoutId: string;
      userId: string;
    }) => {
      const result = await rejectAffiliatePartnerPayout(userId, payoutId, input);
      if (!result.ok) {
        const error = new Error(result.error) as PayoutMutationError;
        error.status = result.status;
        error.code = result.code;
        throw error;
      }
      return { payout: result.data, userId };
    },
    meta: { disableToast: true },
    onError: async (error, { userId }) => {
      const payoutError = error as PayoutMutationError;
      if (payoutError.status === 409) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: affiliatePartnersQueryKeys.payoutsScope(userId),
          }),
          queryClient.invalidateQueries({
            queryKey: affiliatePartnersQueryKeys.analyticsScope(userId),
          }),
        ]);
      }
      options.onError(payoutError);
    },
    onSuccess: async ({ payout, userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: affiliatePartnersQueryKeys.payoutsScope(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: affiliatePartnersQueryKeys.analyticsScope(userId),
        }),
      ]);
      options.onSuccess(payout);
    },
  });

  return { isPending, mutate };
}
