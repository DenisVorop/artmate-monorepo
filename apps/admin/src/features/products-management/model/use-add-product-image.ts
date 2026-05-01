"use client";

import { useMutation } from "@tanstack/react-query";

import { addProductImage } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

type AddProductImageVariables = {
  readonly formData: FormData;
  readonly productId: string;
};

export function useAddProductImage({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось загрузить изображение",
      successMessage: "Изображение загружено",
    },
    mutationFn: ({ formData, productId }: AddProductImageVariables) =>
      addProductImage(productId, formData),
    onSuccess,
  });

  return { isPending, mutate };
}
