"use client";

import { useMutation } from "@tanstack/react-query";

import { createProduct } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useCreateProduct({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать товар",
      successMessage: "Товар создан",
    },
    mutationFn: createProduct,
    onSuccess,
  });

  return { isPending, mutate };
}
