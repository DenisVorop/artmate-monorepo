"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  coloringCollectionsQueryKeys,
  type ColoringCollection,
} from "@/entities/coloring-collections";
import { productsQueryKeys } from "@/entities/products";
import { publishColoringCollection } from "@/shared/actions/colorings";

import type { MutationOptions } from "./mutation-options";

export function usePublishCollection({ onSuccess }: MutationOptions<ColoringCollection> = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось опубликовать цифровую версию",
      successMessage: "Цифровая версия опубликована",
    },
    mutationFn: publishColoringCollection,
    onError: async (_error, collectionId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: coloringCollectionsQueryKeys.detail(collectionId),
        }),
        queryClient.invalidateQueries({
          queryKey: coloringCollectionsQueryKeys.list(),
        }),
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      ]);
    },
    onSuccess: async (collection) => {
      queryClient.setQueryData(
        coloringCollectionsQueryKeys.detail(collection.id),
        collection,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: coloringCollectionsQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: productsQueryKeys.all }),
      ]);
      await onSuccess?.(collection);
    },
  });

  return { isPending, mutate };
}
