"use client";

import { useMutation } from "@tanstack/react-query";

import { publishSeoEntry, type PublishSeoEntryInputDTO } from "@/shared/actions/seo";

import type { MutationOptions } from "./mutation-options";

type PublishSeoEntryVariables = {
  readonly entryId: string;
  readonly input: PublishSeoEntryInputDTO;
};

export function usePublishSeoEntry({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось опубликовать SEO",
      successMessage: "SEO опубликовано",
    },
    mutationFn: ({ entryId, input }: PublishSeoEntryVariables) =>
      publishSeoEntry(entryId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
