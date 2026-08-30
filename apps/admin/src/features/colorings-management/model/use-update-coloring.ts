"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coloringsQueryKeys, type Coloring } from "@/entities/colorings";
import { updateColoring } from "@/shared/actions/colorings";

import type { UpdateColoringInput } from "../lib";
import { invalidateColoringManagement } from "./cache";
import type { ColoringMutationOptions } from "./mutation-options";

type Variables = {
  readonly coloringId: string;
  readonly input: UpdateColoringInput;
};

export function useUpdateColoring({
  onSuccess,
}: ColoringMutationOptions<Coloring> = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить раскраску",
      successMessage: "Раскраска сохранена",
    },
    mutationFn: ({ coloringId, input }: Variables) => updateColoring(coloringId, input),
    onError: async () => {
      await invalidateColoringManagement(queryClient);
    },
    onSuccess: async (coloring) => {
      queryClient.setQueryData(coloringsQueryKeys.detail(coloring.id), coloring);
      await invalidateColoringManagement(queryClient);
      await onSuccess?.(coloring);
    },
  });

  return { isPending, mutate };
}
