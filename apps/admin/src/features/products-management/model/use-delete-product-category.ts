"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProductCategory } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useDeleteProductCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить категорию",
      successMessage: "Категория удалена",
    },
    mutationFn: deleteProductCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
