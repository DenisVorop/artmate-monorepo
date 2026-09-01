"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { WorkshopModerationDecisionInput } from "@/entities/workshop-moderation";
import { decideWorkshopModerationRevision } from "@/shared/actions/workshop-moderation";

import { updateWorkshopModerationCache } from "./cache";

type Variables = {
  readonly input: WorkshopModerationDecisionInput & {
    readonly decision: "HIDE";
  };
  readonly revisionId: string;
};

export function useHideWorkshopRevision() {
  const queryClient = useQueryClient();
  const { error, isPending, mutate, reset } = useMutation({
    meta: { disableToast: true },
    mutationFn: ({ input, revisionId }: Variables) =>
      decideWorkshopModerationRevision(revisionId, input),
    onSuccess: async (detail) => {
      await updateWorkshopModerationCache(queryClient, detail);
    },
  });

  return {
    errorMessage: error instanceof Error ? error.message : undefined,
    isPending,
    mutate,
    reset,
  };
}
