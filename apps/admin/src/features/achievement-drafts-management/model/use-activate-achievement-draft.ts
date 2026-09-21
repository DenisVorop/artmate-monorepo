"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { achievementDraftsQueryKeys } from "@/entities/achievement-drafts";
import { activateAchievementDraft } from "@/shared/actions/achievement-drafts";
import { showToast } from "@/shared/lib/toast-store";

import { unwrapAchievementMutation } from "./mutation-result";

type ActivateAchievementDraftVariables = {
  readonly achievementId: string;
  readonly expectedVersion: number;
};

export function useActivateAchievementDraft(options?: {
  readonly onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: { disableToast: true },
    mutationFn: async ({
      achievementId,
      expectedVersion,
    }: ActivateAchievementDraftVariables) =>
      unwrapAchievementMutation(
        await activateAchievementDraft(achievementId, { expectedVersion }),
      ),
    onError: (error) =>
      showToast({
        description: error instanceof Error ? error.message : undefined,
        title: "Не удалось активировать ачивку",
        variant: "error",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: achievementDraftsQueryKeys.all,
      });
      showToast({ title: "Ачивка активирована" });
      options?.onSuccess?.();
    },
  });

  return { isPending, mutate };
}
