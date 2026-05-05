"use client";

import { useMutation } from "@tanstack/react-query";

import { startAiBlogDraftRun } from "@/shared/actions/content-assistant";

export function useStartAiBlogDraftRun() {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось запустить AI draft",
      successMessage: "Темы отправлены в Telegram на согласование",
    },
    mutationFn: startAiBlogDraftRun,
  });

  return { isPending, mutate };
}
