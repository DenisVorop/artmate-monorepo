"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { publishColoringRevision } from "@/shared/actions/colorings";

import { invalidateColoringManagement } from "./cache";

type Variables = {
  readonly coloringId: string;
  readonly revisionId: string;
};

export function usePublishColoringRevision() {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось опубликовать ревизию",
      successMessage: "Ревизия опубликована",
    },
    mutationFn: ({ coloringId, revisionId }: Variables) =>
      publishColoringRevision(coloringId, revisionId),
    onError: () => invalidateColoringManagement(queryClient),
    onSuccess: () => invalidateColoringManagement(queryClient),
  });

  return { isPending, mutate };
}
