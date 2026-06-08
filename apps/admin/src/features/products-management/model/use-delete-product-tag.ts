"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteProductTag } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useDeleteProductTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить тег",
      successMessage: "Тег удален",
    },
    mutationFn: deleteProductTag,
    onSuccess,
  });

  return { isPending, mutate };
}
