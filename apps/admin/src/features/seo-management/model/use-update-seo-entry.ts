"use client";

import { useMutation } from "@tanstack/react-query";

import { updateSeoEntry, type UpdateSeoEntryInputDTO } from "@/shared/actions/seo";

import type { MutationOptions } from "./mutation-options";

type UpdateSeoEntryVariables = {
  readonly entryId: string;
  readonly input: UpdateSeoEntryInputDTO;
};

export function useUpdateSeoEntry({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить SEO черновик",
      successMessage: "SEO черновик сохранен",
    },
    mutationFn: ({ entryId, input }: UpdateSeoEntryVariables) =>
      updateSeoEntry(entryId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
