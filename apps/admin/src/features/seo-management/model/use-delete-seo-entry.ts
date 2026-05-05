"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteSeoEntry } from "@/shared/actions/seo";

import type { MutationOptions } from "./mutation-options";

export function useDeleteSeoEntry({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить SEO запись",
      successMessage: "SEO запись удалена",
    },
    mutationFn: deleteSeoEntry,
    onSuccess,
  });

  return { isPending, mutate };
}
