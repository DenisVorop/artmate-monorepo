"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProduct } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useDeleteProduct({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить товар",
      successMessage: "Товар удален",
    },
    mutationFn: deleteProduct,
    onSuccess,
  });

  return { isPending, mutate };
}
