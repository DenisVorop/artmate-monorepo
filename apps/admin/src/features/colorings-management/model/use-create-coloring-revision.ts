"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createColoringRevision } from "@/shared/actions/colorings";

import { invalidateColoringManagement } from "./cache";
import type { ColoringMutationOptions } from "./mutation-options";

type Variables = {
  readonly coloringId: string;
  readonly formData: FormData;
};

export function useCreateColoringRevision({ onSuccess }: ColoringMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать ревизию",
      successMessage: "Ревизия создана",
    },
    mutationFn: ({ coloringId, formData }: Variables) =>
      createColoringRevision(coloringId, formData),
    onSuccess: async () => {
      await invalidateColoringManagement(queryClient);
      await onSuccess?.();
    },
  });

  return { isPending, mutate };
}
