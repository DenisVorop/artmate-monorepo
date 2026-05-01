"use client";

import { useMutation } from "@tanstack/react-query";

import { updateProduct, type UpdateProductInputDTO } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type UpdateProductVariables = {
  readonly input: UpdateProductInputDTO;
  readonly productId: string;
};

export function useUpdateProduct({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось сохранить товар",
      successMessage: "Товар сохранен",
    },
    mutationFn: ({ input, productId }: UpdateProductVariables) =>
      updateProduct(productId, input),
    onSuccess,
  });

  return { isPending, mutate };
}
