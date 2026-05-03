"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteBlogTag } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useDeleteBlogTag({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить тег",
      successMessage: "Тег удален",
    },
    mutationFn: deleteBlogTag,
    onSuccess,
  });

  return { isPending, mutate };
}
