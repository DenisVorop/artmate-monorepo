"use client";

import { useMutation } from "@tanstack/react-query";

import { createSeoEntry, type CreateSeoEntryInputDTO } from "@/shared/actions/seo";

import type { MutationOptions } from "./mutation-options";

export function useCreateSeoEntry({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать SEO запись",
      successMessage: "SEO запись создана",
    },
    mutationFn: (input: CreateSeoEntryInputDTO) => createSeoEntry(input),
    onSuccess,
  });

  return { isPending, mutate };
}
