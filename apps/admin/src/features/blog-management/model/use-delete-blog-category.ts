"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteBlogCategory } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useDeleteBlogCategory({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить категорию",
      successMessage: "Категория удалена",
    },
    mutationFn: deleteBlogCategory,
    onSuccess,
  });

  return { isPending, mutate };
}
