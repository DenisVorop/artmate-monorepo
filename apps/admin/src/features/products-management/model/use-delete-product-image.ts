"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProductImage } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type DeleteProductImageVariables = {
  readonly imageId: string;
  readonly productId: string;
};

export function useDeleteProductImage({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить изображение",
      successMessage: "Изображение удалено",
    },
    mutationFn: ({ imageId, productId }: DeleteProductImageVariables) =>
      deleteProductImage(productId, imageId),
    onSuccess,
  });

  return { isPending, mutate };
}
