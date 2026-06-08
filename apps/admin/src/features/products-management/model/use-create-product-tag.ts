"use client";

import { useMutation } from "@tanstack/react-query";

import { createProductTag } from "@/shared/actions/products";

import type { MutationOptions } from "./mutation-options";

export function useCreateProductTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать тег",
      successMessage: "Тег создан",
    },
    mutationFn: createProductTag,
    onSuccess,
  });

  return { isPending, mutate };
}
