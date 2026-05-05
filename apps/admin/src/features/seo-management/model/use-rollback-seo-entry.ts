"use client";

import { useMutation } from "@tanstack/react-query";

import { rollbackSeoEntry, type RollbackSeoEntryInputDTO } from "@/shared/actions/seo";

import type { MutationOptions } from "./mutation-options";

type RollbackSeoEntryVariables = {
  readonly entryId: string;
  readonly input: RollbackSeoEntryInputDTO;
};

export function useRollbackSeoEntry({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось восстановить snapshot",
      successMessage: "Snapshot восстановлен в черновик",
    },
    mutationFn: ({ entryId, input }: RollbackSeoEntryVariables) =>
      rollbackSeoEntry(entryId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
