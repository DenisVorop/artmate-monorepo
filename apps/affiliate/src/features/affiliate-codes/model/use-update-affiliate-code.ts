"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { affiliateCodeQueryKeys } from "@/entities/affiliate-code";
import {
  updateAffiliateCode,
  type UpdateAffiliateCodeInputDTO,
} from "@/shared/actions/affiliate";
import { useQueryOwnerId } from "@/shared/lib/query-owner";

type UpdateAffiliateCodeVariables = {
  readonly codeId: string;
  readonly input: UpdateAffiliateCodeInputDTO;
};

export function useUpdateAffiliateCode() {
  const ownerId = useQueryOwnerId();
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    mutationFn: ({ codeId, input }: UpdateAffiliateCodeVariables) =>
      updateAffiliateCode(codeId, input),
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
