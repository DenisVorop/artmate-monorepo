"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  coloringCollectionsQueryKeys,
  type ColoringCollection,
} from "@/entities/coloring-collections";
import { productsQueryKeys } from "@/entities/products";
import {
  updateColoringCollection,
  type UpdateColoringCollectionInputDTO,
} from "@/shared/actions/colorings";

import type { MutationOptions } from "./mutation-options";

type Variables = {
  readonly collectionId: string;
  readonly input: UpdateColoringCollectionInputDTO;
};

export function useUpdateCollection({ onSuccess }: MutationOptions<ColoringCollection> = {}) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить цифровую версию",
      successMessage: "Изменения сохранены",
    },
    mutationFn: ({ collectionId, input }: Variables) =>
      updateColoringCollection(collectionId, input),
    onError: async (_error, { collectionId }) => {
      await queryClient.invalidateQueries({
        queryKey: coloringCollectionsQueryKeys.detail(collectionId),
      });
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
