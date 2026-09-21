"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { achievementDraftsQueryKeys } from "@/entities/achievement-drafts";
import { archiveAchievementDraft } from "@/shared/actions/achievement-drafts";
import { showToast } from "@/shared/lib/toast-store";

import { unwrapAchievementMutation } from "./mutation-result";

type ArchiveAchievementDraftVariables = {
  readonly achievementId: string;
  readonly expectedVersion: number;
};

export function useArchiveAchievementDraft(options?: {
  readonly onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: { disableToast: true },
    mutationFn: async ({
      achievementId,
      expectedVersion,
    }: ArchiveAchievementDraftVariables) =>
      unwrapAchievementMutation(
        await archiveAchievementDraft(achievementId, { expectedVersion }),
      ),
    onError: (error) =>
      showToast({
        description: error instanceof Error ? error.message : undefined,
        title: "Не удалось архивировать ачивку",
        variant: "error",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: achievementDraftsQueryKeys.all,
      });
      showToast({ title: "Ачивка перемещена в архив" });
      options?.onSuccess?.();
    },
  });

  return { isPending, mutate };
}
