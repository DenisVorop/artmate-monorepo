"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { coloringCollectionsQueryKeys } from "@/entities/coloring-collections";
import { coloringsQueryKeys, type Coloring } from "@/entities/colorings";
import { productsQueryKeys } from "@/entities/products";
import { createColoring } from "@/shared/actions/colorings";

import type { MutationOptions } from "./mutation-options";

export function useCreateColoring({ onSuccess }: MutationOptions<Coloring> = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать раскраску",
      successMessage: "Раскраска создана",
    },
    mutationFn: createColoring,
    onError: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: coloringsQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: coloringCollectionsQueryKeys.all,
        }),
      ]);
    },
    onSuccess: async (coloring) => {
      queryClient.setQueryData(coloringsQueryKeys.detail(coloring.id), coloring);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: coloringsQueryKeys.list() }),
        queryClient.invalidateQueries({
          queryKey: coloringCollectionsQueryKeys.detail(coloring.collectionId),
        }),
        queryClient.invalidateQueries({ queryKey: coloringCollectionsQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      ]);
      await onSuccess?.(coloring);
    },
  });

  return { isPending, mutate };
}
