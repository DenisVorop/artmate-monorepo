"use client";

import { useMutation } from "@tanstack/react-query";

import { deleteBlogPost } from "@/shared/actions/blog";

import type { MutationOptions } from "./mutation-options";

export function useDeleteBlogPost({ onSuccess }: MutationOptions = {}) {
  const { isPending, mutate } = useMutation({
    meta: {
      errorMessage: "Не удалось удалить пост",
      successMessage: "Пост удален",
    },
    mutationFn: deleteBlogPost,
    onSuccess,
  });

  return { isPending, mutate };
}
