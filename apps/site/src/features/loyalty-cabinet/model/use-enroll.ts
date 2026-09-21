"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { loyaltyOverviewSchema, loyaltyQuery } from "@/entities/loyalty";
import { sessionQuery } from "@/entities/session";
import { enrollInLoyalty } from "@/shared/actions/loyalty";
import { ApiResult } from "@/shared/lib/api-result";

import { toEnrollmentInput, type EnrollmentFormValues } from "../lib/enrollment-form";

export function useEnroll(userId: string, termsVersion: string) {
  const queryClient = useQueryClient();
  const { mutate, isPending, isError } = useMutation({
    mutationFn: async (values: EnrollmentFormValues) =>
      loyaltyOverviewSchema.parse(
        ApiResult.fromDTO(
          await enrollInLoyalty(userId, toEnrollmentInput(values, termsVersion)),
        ).unwrap(),
      ),
    onSuccess: async (overview) => {
      const session = queryClient.getQueryData(sessionQuery.getSession().queryKey);
      if (session?.user?.id !== userId) return;
      queryClient.setQueryData(loyaltyQuery.overview(userId).queryKey, overview);
      await queryClient.invalidateQueries({ queryKey: loyaltyQuery.userKey(userId) });
    },
  });
  return { mutate, isPending, isError };
}
