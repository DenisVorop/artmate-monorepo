"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteBlogAuthor } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useDeleteBlogAuthor({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить автора",
      successMessage: "Автор удален",
    },
    mutationFn: deleteBlogAuthor,
    onSuccess,
  });

  return { isPending, mutate };
}
