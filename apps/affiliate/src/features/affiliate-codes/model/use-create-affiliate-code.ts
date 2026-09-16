"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliateCodeQueryKeys } from "@/entities/affiliate-code";
import {
  createAffiliateCode,
  type CreateAffiliateCodeInputDTO,
} from "@/shared/actions/affiliate";
import { useQueryOwnerId } from "@/shared/lib/query-owner";

export function useCreateAffiliateCode() {
  const ownerId = useQueryOwnerId();
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    mutationFn: (input: CreateAffiliateCodeInputDTO) =>
      createAffiliateCode(input),
    onSuccess: async (result) => {
      if (result.ok) {
        await queryClient.invalidateQueries({
          queryKey: affiliateCodeQueryKeys.lists(ownerId),
        });
      }
    },
  });

  return { isPending, mutate };
}
