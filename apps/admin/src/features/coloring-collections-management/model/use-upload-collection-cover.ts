"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  coloringCollectionsQueryKeys,
  type ColoringCollection,
} from "@/entities/coloring-collections";
import { productsQueryKeys } from "@/entities/products";
import { uploadColoringCollectionCover } from "@/shared/actions/colorings";

import type { MutationOptions } from "./mutation-options";

type Variables = {
  readonly collectionId: string;
  readonly formData: FormData;
};

export function useUploadCollectionCover(
  { onSuccess }: MutationOptions<ColoringCollection> = {},
) {
  const queryClient = useQueryClient();
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось загрузить обложку",
      successMessage: "Обложка обновлена",
    },
    mutationFn: ({ collectionId, formData }: Variables) =>
      uploadColoringCollectionCover(collectionId, formData),
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
