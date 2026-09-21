"use client";

import { useMutation } from "@tanstack/react-query";

import { uploadAchievementImage } from "@/shared/actions/achievement-drafts";
import { showToast } from "@/shared/lib/toast-store";

import { unwrapAchievementMutation } from "./mutation-result";

export function useUploadAchievementImage() {
  const { isPending, mutate } = useMutation({
    meta: { disableToast: true },
    mutationFn: async (formData: FormData) =>
      unwrapAchievementMutation(await uploadAchievementImage(formData)),
    onError: (error) =>
      showToast({
        description: error instanceof Error ? error.message : undefined,
        title: "Не удалось загрузить изображение",
        variant: "error",
      }),
    onSuccess: () => showToast({ title: "Изображение загружено" }),
  });

  return { isPending, mutate };
}
