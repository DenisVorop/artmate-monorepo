"use client";

import { useMutation } from "@tanstack/react-query";

import {
  updateProductImage,
  type UpdateProductImageInputDTO,
} from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type UpdateProductImageVariables = {
  readonly imageId: string;
  readonly input: UpdateProductImageInputDTO;
  readonly productId: string;
};

export function useUpdateProductImage({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить изображение",
      successMessage: "Изображение сохранено",
    },
    mutationFn: ({ imageId, input, productId }: UpdateProductImageVariables) =>
      updateProductImage(productId, imageId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
