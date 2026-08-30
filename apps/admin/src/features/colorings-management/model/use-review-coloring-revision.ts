"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { reviewColoringRevision } from "@/shared/actions/colorings";

import type { ColoringReviewInput } from "../lib";
import { invalidateColoringManagement } from "./cache";
import type { ColoringMutationOptions } from "./mutation-options";

type Variables = {
  readonly coloringId: string;
  readonly input: ColoringReviewInput;
  readonly revisionId: string;
};

export function useReviewColoringRevision({ onSuccess }: ColoringMutationOptions = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось отправить решение",
      successMessage: "Решение сохранено",
    },
    mutationFn: ({ coloringId, input, revisionId }: Variables) =>
      reviewColoringRevision(coloringId, revisionId, input),
    onError: () => invalidateColoringManagement(queryClient),
    onSuccess: async () => {
      await invalidateColoringManagement(queryClient);
      await onSuccess?.();
    },
  });

  return { isPending, mutate };
}
