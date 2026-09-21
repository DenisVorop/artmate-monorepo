"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { achievementDraftsQueryKeys } from "@/entities/achievement-drafts";
import {
  updateAchievementDraft,
  type UpdateAchievementDraftInputDTO,
} from "@/shared/actions/achievement-drafts";
import { showToast } from "@/shared/lib/toast-store";

import { unwrapAchievementMutation } from "./mutation-result";

type UpdateAchievementDraftVariables = {
  readonly achievementId: string;
  readonly input: UpdateAchievementDraftInputDTO;
};

export function useUpdateAchievementDraft(options?: {
  readonly onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: { disableToast: true },
    mutationFn: async ({
      achievementId,
      input,
    }: UpdateAchievementDraftVariables) =>
      unwrapAchievementMutation(
        await updateAchievementDraft(achievementId, input),
      ),
    onError: (error) =>
      showToast({
        description: error instanceof Error ? error.message : undefined,
        title: "Не удалось сохранить ачивку",
        variant: "error",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: achievementDraftsQueryKeys.all,
      });
      showToast({ title: "Черновик ачивки сохранён" });
      options?.onSuccess?.();
    },
  });

  return { isPending, mutate };
}
