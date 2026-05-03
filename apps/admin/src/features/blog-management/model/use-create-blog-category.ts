"use client";

import { useMutation } from "@tanstack/react-query";

import { createBlogCategory } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useCreateBlogCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось создать категорию",
      successMessage: "Категория создана",
    },
    mutationFn: createBlogCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
