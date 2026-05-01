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
    mutationFn: ({ imageId, productId }: DeleteProductImageVariables) =>
      deleteProductImage(productId, imageId),
    onSuccess,
  });

  return { isPending, mutate };
}
