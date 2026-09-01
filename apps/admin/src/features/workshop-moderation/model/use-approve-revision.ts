"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { decideWorkshopModerationRevision } from "@/shared/actions/workshop-moderation";

import { updateWorkshopModerationCache } from "./cache";
import type { WorkshopModerationMutationOptions } from "./mutation-options";

export function useApproveWorkshopRevision({
  onSuccess,
}: WorkshopModerationMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { error, isPending, mutate, reset } = useMutation({
    meta: {
      disableToast: true,
    },
    mutationFn: (revisionId: string) =>
      decideWorkshopModerationRevision(revisionId, { decision: "APPROVE" }),
    onSuccess: async (detail) => {
      await updateWorkshopModerationCache(queryClient, detail);
      onSuccess?.();
    },
  });

  return {
    errorMessage: error instanceof Error ? error.message : undefined,
    isPending,
    mutate,
    reset,
  };
}
