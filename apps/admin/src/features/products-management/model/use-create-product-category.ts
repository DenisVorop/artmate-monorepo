"use client";

import { useMutation } from "@tanstack/react-query";

import { createProductCategory } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useCreateProductCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать категорию",
      successMessage: "Категория создана",
    },
    mutationFn: createProductCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
