"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { achievementDraftsQueryKeys } from "@/entities/achievement-drafts";
import {
  createAchievementDraft,
  type CreateAchievementDraftInputDTO,
} from "@/shared/actions/achievement-drafts";
import { showToast } from "@/shared/lib/toast-store";

import { unwrapAchievementMutation } from "./mutation-result";

export function useCreateAchievementDraft(options?: {
  readonly onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { isPending, mutateAsync: mutate } = useMutation({
    meta: { disableToast: true },
    mutationFn: async (input: CreateAchievementDraftInputDTO) =>
      unwrapAchievementMutation(await createAchievementDraft(input)),
    onError: (error) =>
      showToast({
        description: error instanceof Error ? error.message : undefined,
        title: "Не удалось создать ачивку",
        variant: "error",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: achievementDraftsQueryKeys.all,
      });
      showToast({ title: "Черновик ачивки создан" });
      options?.onSuccess?.();
    },
  });

  return { isPending, mutate };
}
